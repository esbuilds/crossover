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
export const unbracket = (t: string) => t.replace(BRACKET, "$1");

function walk(v: unknown, names: Set<string>, nums: number[]) {
  if (Array.isArray(v)) return v.forEach((x) => walk(x, names, nums));
  if (typeof v === "number") return void nums.push(v);
  if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      if (k === "name" && typeof x === "string") names.add(x);
      else walk(x, names, nums);
    }
}
const facts = (steps: StepRecord[]) => {
  const names = new Set<string>(), nums: number[] = [];
  for (const s of steps) walk(s.output, names, nums);
  return { names, nums };
};

export function checkDecision(d: Decision, steps: StepRecord[]): Check {
  const problems: string[] = [];
  const all = facts(steps);
  const items: (Cited & { label: string; name?: string })[] = [
    ...d.calls.map((c, i) => ({ label: `call ${i + 1}`, text: c.reason, steps: c.steps, name: c.name })),
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
    for (const n of named) if (!cited.names.has(n)) problems.push(`${it.label}: ${n} isn't in a cited step`);
    for (const m of plain.matchAll(/(?<![\w.])\d+(?:\.\d+)?/g)) {
      const x = m[0];
      const hit = x.includes(".") ? cited.nums.some((v) => v.toFixed(2) === Number(x).toFixed(2)) : cited.nums.includes(Number(x));
      if (!hit) problems.push(`${it.label}: ${x} isn't in a cited step`);
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true };
}
