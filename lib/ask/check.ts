// lib/ask/check.ts
// The ask agent's decision is shown only if every name and number in it traces to a step it cites.
// Names: under a key literally named "name" in tool outputs (the tools' contract). Numbers: any numeric leaf;
// decimals compare at two places, integers exactly.
// ponytail: a brand the run never measured and the model didn't bracket can't be caught by name; calls[].name is
// exact-match and the prompt brackets every name, which covers the paths that matter.
export type Cited = { text: string; steps: number[] };
export type Decision = { calls: { name: string; reason: string; steps: number[] }[]; cautions: Cited[]; summary: Cited[] };
export type StepRecord = { n: number; tool: string; why: string; output: unknown; summary: string };
export type Check = { ok: true } | { ok: false; problems: string[] };

const BRACKET = /\[\[([^\]]+)\]\]/g;
const DECIMAL = /(?<![\w.])\d+\.\d+/g;
// the fixed list from Fable's judge-probe ruling (Oct 15); a semicolon counts too
// plus a count of others ("seven others", "7 others"; Fable's checker sign-off, Oct 15), bound as "the others" is
const CONTRAST = /\b(?:against|versus|vs\.?|compared with|while|whereas|for the others|for the rest|the others|the rest|(?:[2-9]|\d{2,}|two|three|four|five|six|seven|eight|nine) others?)\b|;/i;
export const CHECK_RULE = "v2"; // v1 until real Oct 15: a number after the first brand, up to the next name, was its own
export const unbracket = (t: string) => t.replace(BRACKET, "$1");

// Render only: a Qloo name that reads as a word gets the brand name from Qloo's own description. The checker never sees
// these. ponytail: keyed by name, so a second entity with the same bare name would borrow it; key by id if one appears.
const DISPLAY: Record<string, string> = {
  Alternative: "Alternative Apparel", // Qloo 26B1E073-D09A-4242-AD7F-EED546CE55A7: "Alternative Apparel is a sustainable clothing brand"
};
export const displayName = (name: string) => DISPLAY[name] ?? name;
export const forDisplay = (t: string) => t.replace(BRACKET, (_, n: string) => displayName(n));
// a single name, bracketed or not (a call's name field arrives either way)
export const nameForDisplay = (n: string) => displayName(unbracket(n));

function walk(v: unknown, names: Set<string>, nums: number[]) {
  if (Array.isArray(v)) return v.forEach((x) => walk(x, names, nums));
  if (typeof v === "number") return void nums.push(v);
  if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      if (k === "name" && typeof x === "string") names.add(x);
      else walk(x, names, nums);
    }
}
// each named object's own numbers (its affinity, its ranks), for binding a quoted score to the brand it's quoted for
function owned(v: unknown, out: Map<string, number[]>) {
  if (Array.isArray(v)) return v.forEach((x) => owned(x, out));
  if (!v || typeof v !== "object") return;
  const o = v as Record<string, unknown>;
  if (typeof o.name === "string") out.set(o.name, [...(out.get(o.name) ?? []), ...Object.values(o).filter((x): x is number => typeof x === "number")]);
  for (const x of Object.values(o)) owned(x, out);
}
const facts = (steps: StepRecord[]) => {
  const names = new Set<string>(), nums: number[] = [];
  for (const s of steps) walk(s.output, names, nums);
  return { names, nums };
};

export function checkDecision(d: Decision, steps: StepRecord[]): Check {
  const problems: string[] = [];
  const all = facts(steps);
  // the seed is the subject of every step: a confirmed resolve step's name counts in any sentence (first live run, Oct 13)
  const seed = facts(steps.filter((s) => s.tool === "resolve" && (s.output as { state?: string })?.state === "confirmed")).names;
  const items: (Cited & { label: string; name?: string })[] = [
    ...d.calls.map((c, i) => ({ label: `call ${i + 1}`, text: c.reason, steps: c.steps, name: unbracket(c.name) })),
    ...d.cautions.map((c, i) => ({ ...c, label: `caution ${i + 1}` })),
    ...d.summary.map((c, i) => ({ ...c, label: `summary ${i + 1}` })),
  ];
  for (const it of items) {
    if (!it.steps.length) { problems.push(`${it.label} cites no step`); continue; }
    const missing = it.steps.filter((n) => !steps.some((s) => s.n === n));
    if (missing.length) { problems.push(`${it.label} cites step ${missing.join(", ")}, which doesn't exist`); continue; }
    const cited = facts(steps.filter((s) => it.steps.includes(s.n)));
    const named = [...it.text.matchAll(BRACKET)].map((m) => m[1]);
    if (it.name) named.push(it.name);
    const plain = it.text.replace(BRACKET, " ");
    for (const n of all.names) if (n.length >= 3 && new RegExp(`(^|[^\\w])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w]|$)`).test(plain)) named.push(n);
    for (const n of named) if (!cited.names.has(n) && !seed.has(n)) problems.push(`${it.label}: ${n} isn't in a cited step`);
    // a score right after the first brand named (the seed aside), before any other name, must be that brand's own
    // number or a method number (final review, Oct 13; narrowed so group ranges and comparisons stay step-checked)
    const own = new Map<string, number[]>();
    for (const st of steps.filter((x) => it.steps.includes(x.n))) owned(st.output, own);
    const method = steps.filter((x) => it.steps.includes(x.n)).flatMap((x) => Object.values(((x.output as { method?: Record<string, number> })?.method) ?? {}));
    const first = [...it.text.matchAll(BRACKET)].find((m) => !seed.has(m[1]));
    if (first) {
      const after = it.text.slice(first.index! + first[0].length);
      const upto = after.includes("[[") ? after.indexOf("[[") : after.length;
      // rule v2 (Fable's judge-probe ruling, real Oct 15): the first brand's segment also ends at a contrast marker.
      // Numbers after the marker belong to the next bracketed brand if one follows, else to some other candidate.
      const cut = after.slice(0, upto).search(CONTRAST);
      const segment = after.slice(0, cut >= 0 ? cut : upto);
      const is = (vs: number[], x: string) => vs.some((v) => v.toFixed(2) === Number(x).toFixed(2));
      const mine = [...(own.get(first[1]) ?? []), ...method];
      for (const m of segment.matchAll(DECIMAL)) if (!is(mine, m[0])) problems.push(`${it.label}: ${m[0]} isn't ${first[1]}'s own number`);
      if (cut >= 0) {
        const next = after.slice(upto).match(/^\[\[([^\]]+)\]\]/)?.[1];
        const theirs = next ? [...(own.get(next) ?? []), ...method] : [...[...own].filter(([n]) => n !== first[1]).flatMap(([, v]) => v), ...method];
        for (const m of after.slice(cut, upto).matchAll(DECIMAL))
          if (!is(theirs, m[0])) problems.push(`${it.label}: ${m[0]} isn't ${next ? `${next}'s own number` : "another candidate's own number"}`);
      }
    }
    for (const m of plain.matchAll(/(?<![\w.])\d+(?:\.\d+)?/g)) {
      const x = m[0];
      const hit = x.includes(".") ? cited.nums.some((v) => v.toFixed(2) === Number(x).toFixed(2)) : cited.nums.includes(Number(x));
      if (!hit) problems.push(`${it.label}: ${x} isn't in a cited step`);
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true };
}
