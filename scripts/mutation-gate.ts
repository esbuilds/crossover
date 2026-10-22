// Break-the-checker gate (moonshots round 4, real Oct 18), over the cache only: 0 Qloo, 0 Anthropic calls.
// Every passing cached ask is copied, one fact is tampered with per copy, and rule v2 re-checks the copy. Nothing is
// written back. Reports the catch rate per tamper kind and lists every miss.
//   node --env-file=.env.local scripts/mutation-gate.ts [--write]   (--write saves audit/mutation.json for /audit)
import { writeFileSync } from "node:fs";
import { CHECK_RULE } from "../lib/ask/check.ts";
import { checkDecision, type Check, type Decision, type StepRecord } from "../lib/ask/check.ts";
import { stepsFrom } from "../lib/ask/steps.ts";
import type { AskEvent } from "../lib/ask/agent.ts";

const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
const run = async (commands: (string | number)[][]) =>
  ((await (await fetch(`${url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(commands) })).json()) as { result?: unknown }[]).map((r) => r.result);

const keys: string[] = [];
let cursor = "0";
do {
  const [[next, batch]] = (await run([["SCAN", cursor, "MATCH", "cx:ask:*", "COUNT", 1000]])) as [string, string[]][];
  cursor = next;
  keys.push(...batch);
} while (cursor !== "0");

type Run = { seed: string; d: Decision; steps: StepRecord[] };
const runs: Run[] = [];
for (const key of keys) {
  const [raw] = (await run([["GET", key]])) as (string | null)[];
  const events = ((raw ? (JSON.parse(raw) as { trace?: string[] }) : null)?.trace ?? []).map((s) => JSON.parse(s)) as AskEvent[];
  const last = events.findLast((e) => e.type === "decision") as { decision: Decision | null } | undefined;
  if (!last?.decision) continue;
  const steps = stepsFrom(events);
  if (!checkDecision(last.decision, steps).ok) continue; // only answers the page actually shows
  runs.push({ seed: (steps.find((s) => s.tool === "resolve")?.output as { name?: string })?.name ?? "?", d: last.decision, steps });
}

// every name under a "name" key in a set of steps (the checker's own contract)
const namesIn = (steps: StepRecord[]) => {
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
const INVENTED = "Vantorra"; // not a Qloo entity in any cached step (asserted below)

type Item = { text: string; steps: number[] };
const items = (d: Decision): Item[] => [...d.calls.map((c) => ({ text: c.reason, steps: c.steps })), ...d.cautions, ...d.summary];
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
const KINDS: Kind[] = [
  { kind: "score nudged by 0.03", expectCatch: true, make: (r) => onFirst(r.d, (it) => {
    const m = it.text.match(/(?<![\w.])\d+\.\d+/);
    return m ? { text: it.text.replace(m[0], (Number(m[0]) + 0.03).toFixed(m[0].split(".")[1].length)) } : null;
  }) },
  { kind: "count or rank changed by 1", expectCatch: true, make: (r) => onFirst(r.d, (it) => {
    const m = it.text.replace(/\[\[[^\]]+\]\]/g, (s) => " ".repeat(s.length)).match(/(?<![\w.])\d+(?!\d|\.\d)/); // v3.1 (real Oct 22): a rank ending a sentence is tampered with too; until then this shared the checker's blind spot
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

if (runs.some((r) => namesIn(r.steps).has(INVENTED))) throw new Error(`${INVENTED} appears in a cached step; pick another invented name`);
console.log(`${keys.length} cached asks scanned, ${runs.length} passing answers tampered with\n`);
let total = 0, caught = 0, expectedTotal = 0, expectedCaught = 0;
const report: { kind: string; gated: boolean; applied: number; rejected: number; misses: { seed: string; text: string }[] }[] = [];
for (const k of KINDS) {
  let applied = 0, rejected = 0;
  const misses: string[] = [];
  const missed: { seed: string; text: string }[] = [];
  for (const r of runs) {
    const m = k.make(r);
    if (!m) continue;
    applied++;
    const res: Check = checkDecision(m, r.steps);
    if (!res.ok) rejected++;
    else {
      misses.push(r.seed);
      // the tampered sentence (a citation-only tamper changes no text), published on /audit
      const before = items(r.d).map((i) => i.text), after = items(m).map((i) => i.text);
      const at = after.findIndex((t, i) => t !== before[i]);
      missed.push({ seed: r.seed, text: at >= 0 ? after[at] : "" });
      if (process.env.VERBOSE && at >= 0) console.log(`      ${r.seed}: ${after[at].slice(0, 220)}`);
    }
  }
  report.push({ kind: k.kind, gated: k.expectCatch, applied, rejected, misses: missed });
  total += applied; caught += rejected;
  if (k.expectCatch) { expectedTotal += applied; expectedCaught += rejected; }
  console.log(`${k.expectCatch ? "  " : "* "}${k.kind}: ${rejected} of ${applied} rejected${misses.length ? ` | passed: ${misses.join(", ")}` : ""}`);
}
console.log(`\nAll tampers: ${caught} of ${total} rejected`);
console.log(`Tampers the rule claims to catch: ${expectedCaught} of ${expectedTotal} rejected (${expectedTotal ? ((expectedCaught / expectedTotal) * 100).toFixed(1) : "-"} percent; gate is 95)`);
console.log(`GATE ${expectedTotal && expectedCaught / expectedTotal >= 0.95 ? "PASS" : "FAIL"}`);
console.log("* the documented ceiling in check.ts: published as a known miss, not counted in the gate");
if (process.argv.includes("--write")) {
  writeFileSync("audit/mutation.json", JSON.stringify({ date: new Date().toISOString().slice(0, 10), rule: CHECK_RULE, answers: runs.length, gated: { rejected: expectedCaught, of: expectedTotal }, before: { rule: "v2", rejected: 207, of: 228 },
    // rule v3 as published Oct 18, and the same v3 against the corrected rank tamper (measured UTC Oct 21, before 369f3d7)
    v3: { date: "2026-10-18", rejected: 217, of: 228, withNewTamper: { rejected: 217, of: 230 } }, gap: { found: "2026-10-21", fix: "369f3d7" }, kinds: report }, null, 2) + "\n");
  console.log("wrote audit/mutation.json");
}
