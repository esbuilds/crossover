// The checker attack's tampers, moved out of scripts/mutation-gate.ts unchanged
// so the no-keys verify (scripts/verify.ts) runs the same kinds over the recorded asks. Pure: 0 calls.
import { checkDecision, type Decision, type StepRecord } from "./check.ts";

export type Run = { seed: string; d: Decision; steps: StepRecord[] };

// every name under a "name" key in a set of steps (the checker's own contract)
export const namesIn = (steps: StepRecord[]) => {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if (k === "name" && typeof x === "string") out.add(x);
      else walk(x);
    }
  };
  steps.forEach((s) => walk(s.output));
  return out;
};
export const INVENTED = "Vantorra"; // not a Qloo entity in any cached step (asserted below)

type Item = { text: string; steps: number[] };
export const items = (d: Decision): Item[] => [...d.calls.map((c) => ({ text: c.reason, steps: c.steps })), ...d.cautions, ...d.summary];
const clone = (d: Decision): Decision => JSON.parse(JSON.stringify(d));
// apply f to the first item (in reading order) where it changes something
const onFirst = (d: Decision, f: (it: Item) => Partial<Item> | null): Decision | null => {
  const c = clone(d);
  const all: Item[] = [...c.calls.map((x) => ({ get text() { return x.reason; }, set text(t) { x.reason = t; }, get steps() { return x.steps; }, set steps(s) { x.steps = s; } })), ...c.cautions, ...c.summary];
  for (const it of all) {
    const p = f(it);
    if (p) { Object.assign(it, p); return c; }
  }
  return null;
};

type Kind = { kind: string; expectCatch: boolean; make: (r: Run) => Decision | null };
export const KINDS: Kind[] = [
  { kind: "score nudged by 0.03", expectCatch: true, make: (r) => onFirst(r.d, (it) => {
    const m = it.text.match(/(?<![\w.])\d+\.\d+/);
    return m ? { text: it.text.replace(m[0], (Number(m[0]) + 0.03).toFixed(m[0].split(".")[1].length)) } : null;
  }) },
  { kind: "count or rank changed by 1", expectCatch: true, make: (r) => onFirst(r.d, (it) => {
    const m = it.text.replace(/\[\[[^\]]+\]\]/g, (s) => " ".repeat(s.length)).match(/(?<![\w.])\d+(?!\d|\.\d)/); // v3.1: a rank ending a sentence is tampered with too; until then this shared the checker's blind spot
    return m ? { text: it.text.slice(0, m.index!) + String(Number(m[0]) + 1) + it.text.slice(m.index! + m[0].length) } : null;
  }) },
  { kind: "bracketed brand swapped for an invented one", expectCatch: true, make: (r) => onFirst(r.d, (it) => {
    const m = it.text.match(/\[\[([^\]]+)\]\]/);
    return m && m[1] !== r.seed ? { text: it.text.replace(m[0], `[[${INVENTED}]]`) } : null;
  }) },
  { kind: "bracketed brand swapped for a real one the cited steps don't hold", expectCatch: true, make: (r) => onFirst(r.d, (it) => {
    const cited = namesIn(r.steps.filter((s) => it.steps.includes(s.n)));
    const other = [...namesIn(r.steps)].find((n) => !cited.has(n) && n !== r.seed && n.length >= 3);
    const m = it.text.match(/\[\[([^\]]+)\]\]/);
    return m && other && m[1] !== r.seed ? { text: it.text.replace(m[0], `[[${other}]]`) } : null;
  }) },
  { kind: "unbracketed real brand the cited steps don't hold, added", expectCatch: true, make: (r) => onFirst(r.d, (it) => {
    const cited = namesIn(r.steps.filter((s) => it.steps.includes(s.n)));
    const other = [...namesIn(r.steps)].find((n) => !cited.has(n) && n !== r.seed && n.length >= 3);
    return other ? { text: `${it.text} ${other} fits too.` } : null;
  }) },
  // the documented ceiling (check.ts header): a plain-text name no step ever returned can't be matched by name
  { kind: "unbracketed invented brand, added", expectCatch: false, make: (r) => onFirst(r.d, (it) => ({ text: `${it.text} ${INVENTED} fits too.` })) },
  { kind: "citation pointed at a step that doesn't exist", expectCatch: true, make: (r) => onFirst(r.d, () => ({ steps: [999] })) },
  { kind: "citation pointed at the resolve step only", expectCatch: true, make: (r) => {
    const resolve = r.steps.find((s) => s.tool === "resolve")?.n;
    return resolve == null ? null : onFirst(r.d, (it) => (/\d|\[\[/.test(it.text.replace(`[[${r.seed}]]`, "")) && !(it.steps.length === 1 && it.steps[0] === resolve) ? { steps: [resolve] } : null));
  } },
  { kind: "first call renamed to an uncited brand", expectCatch: true, make: (r) => {
    if (!r.d.calls.length) return null;
    const cited = namesIn(r.steps.filter((s) => r.d.calls[0].steps.includes(s.n)));
    const other = [...namesIn(r.steps)].find((n) => !cited.has(n) && n !== r.seed && n.length >= 3);
    if (!other) return null;
    const c = clone(r.d);
    c.calls[0].name = other;
    return c;
  } },
];

export type KindResult = { kind: string; gated: boolean; applied: number; rejected: number; misses: { seed: string; text: string }[] };
// every kind over every run; a miss keeps the tampered sentence (a citation-only tamper changes no text)
export function tamper(runs: Run[]): { kinds: KindResult[]; all: { rejected: number; of: number }; gated: { rejected: number; of: number } } {
  if (runs.some((r) => namesIn(r.steps).has(INVENTED))) throw new Error(`${INVENTED} appears in a step; pick another invented name`);
  const kinds = KINDS.map((k) => {
    const out: KindResult = { kind: k.kind, gated: k.expectCatch, applied: 0, rejected: 0, misses: [] };
    for (const r of runs) {
      const m = k.make(r);
      if (!m) continue;
      out.applied++;
      if (!checkDecision(m, r.steps).ok) { out.rejected++; continue; }
      const before = items(r.d).map((i) => i.text), after = items(m).map((i) => i.text);
      const at = after.findIndex((t, i) => t !== before[i]);
      out.misses.push({ seed: r.seed, text: at >= 0 ? after[at] : "" });
    }
    return out;
  });
  const sum = (ks: KindResult[]) => ({ rejected: ks.reduce((n, k) => n + k.rejected, 0), of: ks.reduce((n, k) => n + k.applied, 0) });
  return { kinds, all: sum(kinds), gated: sum(kinds.filter((k) => k.gated)) };
}
