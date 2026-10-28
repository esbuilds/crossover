// Break-the-checker gate, over the cache only: 0 Qloo, 0 Anthropic calls.
// Every passing cached ask is copied, one fact is tampered with per copy, and rule v2 re-checks the copy. Nothing is
// written back. Reports the catch rate per tamper kind and lists every miss.
//   node --env-file=.env.local scripts/mutation-gate.ts [--write]   (--write saves audit/mutation.json for /audit)
import { writeFileSync } from "node:fs";
import { CHECK_RULE } from "../lib/ask/check.ts";
import { checkDecision, type Decision } from "../lib/ask/check.ts";
import { INVENTED, namesIn, tamper, type Run } from "../lib/ask/tamper.ts";
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

if (runs.some((r) => namesIn(r.steps).has(INVENTED))) throw new Error(`${INVENTED} appears in a cached step; pick another invented name`);
console.log(`${keys.length} cached asks scanned, ${runs.length} passing answers tampered with\n`);
// the kinds and the loop live in lib/ask/tamper.ts, shared with the no-keys verify
const t = tamper(runs);
for (const k of t.kinds) {
  if (process.env.VERBOSE) for (const m of k.misses) if (m.text) console.log(`      ${m.seed}: ${m.text.slice(0, 220)}`);
  console.log(`${k.gated ? "  " : "* "}${k.kind}: ${k.rejected} of ${k.applied} rejected${k.misses.length ? ` | passed: ${k.misses.map((m) => m.seed).join(", ")}` : ""}`);
}
const report = t.kinds;
const [caught, total, expectedCaught, expectedTotal] = [t.all.rejected, t.all.of, t.gated.rejected, t.gated.of];
console.log(`\nAll tampers: ${caught} of ${total} rejected`);
console.log(`Tampers the rule claims to catch: ${expectedCaught} of ${expectedTotal} rejected (${expectedTotal ? ((expectedCaught / expectedTotal) * 100).toFixed(1) : "-"} percent; gate is 95)`);
console.log(`GATE ${expectedTotal && expectedCaught / expectedTotal >= 0.95 ? "PASS" : "FAIL"}`);
console.log("* the documented ceiling in check.ts: published as a known miss, not counted in the gate");
if (process.argv.includes("--write")) {
  writeFileSync("audit/mutation.json", JSON.stringify({ date: new Date().toISOString().slice(0, 10), rule: CHECK_RULE, answers: runs.length, gated: { rejected: expectedCaught, of: expectedTotal }, before: { rule: "v2", rejected: 207, of: 228 },
    // rule v3 as published Oct 18, and the same v3 against the corrected rank tamper (measured UTC Oct 21, before fc78434)
    v3: { date: "2026-10-18", rejected: 217, of: 228, withNewTamper: { rejected: 217, of: 230 } }, gap: { found: "2026-10-21", fix: "fc78434" }, kinds: report }, null, 2) + "\n");
  console.log("wrote audit/mutation.json");
}
