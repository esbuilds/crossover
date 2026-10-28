// Check rule v2's gates, over the cache only: 0 Qloo, 0 Anthropic calls.
// 1) the three frozen asks check identically; 2) every cached ask that passed still passes; 3) the blocked list and Noah
// Kahan, re-checked: which pass under v2 and which still block.
//   node --env-file=.env.local scripts/check-v2-gates.ts
import { createHash } from "node:crypto";
import { checkDecision, type Check, type Decision } from "../lib/ask/check.ts";
import { stepsFrom } from "../lib/ask/steps.ts";
import type { AskEvent } from "../lib/ask/agent.ts";

const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
const run = async (commands: (string | number)[][]) =>
  ((await (await fetch(`${url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(commands) })).json()) as { result?: unknown }[]).map((r) => r.result);

type Entry = { key: string; events: AskEvent[]; seed: string; stored: Check; v2: Check };
const keys: string[] = [];
let cursor = "0";
do {
  const [[next, batch]] = (await run([["SCAN", cursor, "MATCH", "cx:ask:*", "COUNT", 1000]])) as [string, string[]][];
  cursor = next;
  keys.push(...batch);
} while (cursor !== "0");
const entries: Entry[] = [];
for (const key of keys) {
  const [raw] = (await run([["GET", key]])) as (string | null)[];
  const v = raw ? (JSON.parse(raw) as { trace?: string[] }) : null;
  const events = (v?.trace ?? []).map((s) => JSON.parse(s)) as AskEvent[];
  const d = events.findLast((e) => e.type === "decision") as { decision: Decision | null; check: Check } | undefined;
  if (!d?.decision) continue;
  const seed = (stepsFrom(events).find((s) => s.tool === "resolve")?.output as { name?: string } | undefined)?.name ?? "?";
  entries.push({ key, events, seed, stored: d.check, v2: checkDecision(d.decision, stepsFrom(events)) });
}
const keyOf = (version: string, input: object) => `cx:ask:${createHash("sha1").update(JSON.stringify([version, input])).digest("hex")}`;

// Gate 1: the frozen three, by the same keys scripts/ask-hashes.ts reads
const { ASK_VERSION } = await import("../lib/ask/agent.ts");
const frozen = entries.filter((e) => ["Allbirds", "Mt. Joy", "Coca-Cola"].includes(e.seed) && e.stored.ok);
const g1 = frozen.length >= 3 && frozen.every((e) => JSON.stringify(e.stored) === JSON.stringify(e.v2));
console.log(`GATE 1 frozen asks check identically (${frozen.length} cached passing runs for the three seeds): ${g1 ? "PASS" : "FAIL"}`);

// Gate 2: everything that passed still passes
const broke = entries.filter((e) => e.stored.ok && !e.v2.ok);
console.log(`GATE 2 ${entries.filter((e) => e.stored.ok).length} passing cached asks, ${broke.length} now fail: ${broke.length ? "FAIL" : "PASS"}`);
for (const e of broke) console.log(`   broke: ${e.seed} ${JSON.stringify(e.v2)}`);

// Gate 3: every blocked cached ask, re-checked
console.log(`GATE 3 blocked cached asks under v2:`);
for (const e of entries.filter((x) => !x.stored.ok)) console.log(`   ${e.seed}: ${e.v2.ok ? "PASSES" : "still blocked"} | was: ${(e.stored as { problems: string[] }).problems.join("; ").slice(0, 160)}${e.v2.ok ? "" : ` | now: ${(e.v2 as { problems: string[] }).problems.join("; ").slice(0, 160)}`}`);
void keyOf; void ASK_VERSION;
