// What the agent decided, counted (AGENT-6, moonshot round 2, real Oct 22; from the agent lane's agency-probe.mjs).
// Every cached ask in Redis (cx:ask:*, all prompt versions): tool refusals, widenings, ties, stops, blocked answers, and
// the distinct seeds whose ask is cached under the current version (Gate C's list). With --looks, the second looks too.
// Zero Qloo and model calls; reads Redis only. Writes audit/forks.json.
//   node --env-file=.env.local scripts/forks.ts [--looks]
import { writeFileSync } from "node:fs";
import { peekAsk, type AskEvent } from "../lib/ask/agent.ts";
import { decisionEvent, stepsFrom } from "../lib/ask/steps.ts";
import { secondLook, type LookEvent } from "../lib/ask/second.ts";

const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
if (!url || !token) throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are required");
const redis = async (commands: (string | number)[][]) => {
  const res = await fetch(`${url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(commands) });
  return ((await res.json()) as { result?: unknown }[]).map((r) => r.result);
};
const keys: string[] = [];
let cursor = "0";
do {
  const [[next, batch]] = (await redis([["SCAN", cursor, "MATCH", "cx:ask:*", "COUNT", 1000]])) as [string, string[]][];
  cursor = next;
  keys.push(...batch);
} while (cursor !== "0");
const raws = keys.length ? ((await redis(keys.map((k) => ["GET", k]))) as (string | null)[]) : [];

type Seed = { name: string; id: string; type: string };
const asks = raws.flatMap((raw) => {
  const v = raw ? (JSON.parse(raw) as { trace?: string[] }) : null;
  if (!v?.trace) return [];
  const events = v.trace.map((s) => JSON.parse(s)) as AskEvent[];
  const steps = stepsFrom(events);
  const out = (tool: string) => steps.find((s) => s.tool === tool)?.output as Record<string, unknown> | undefined;
  const seed = out("resolve")?.state === "confirmed" ? (out("resolve") as unknown as Seed) : null;
  const d = decisionEvent(events);
  return [{
    seed, refusals: steps.filter((s) => (s.output as { error?: string })?.error).length,
    widened: !!out("candidates")?.note, noClearThree: out("review")?.noClearThree === true,
    calls: d?.decision?.calls.length ?? 0, blocked: !!d && !d.check.ok, decided: !!out("review"),
  }];
});
const decided = asks.filter((a) => a.decided);

// Gate C's list: distinct seeds whose ask peeks under the current version, by id or by its name as typed
const distinct = [...new Map(asks.filter((a) => a.seed).map((a) => [a.seed!.id, a.seed!])).values()];
const seeds: { name: string; body: { id: string; type: string } | { query: string } }[] = [];
for (const s of distinct) {
  const byId = { id: s.id.toUpperCase(), type: s.type };
  if (await peekAsk(byId)) seeds.push({ name: s.name, body: byId });
  else if (await peekAsk({ query: s.name })) seeds.push({ name: s.name, body: { query: s.name } });
}
seeds.sort((a, b) => a.name.localeCompare(b.name));

const counts = {
  asks: asks.length, withRefusal: asks.filter((a) => a.refusals).length, widened: asks.filter((a) => a.widened).length,
  decided: decided.length, noClearThree: decided.filter((a) => a.noClearThree).length,
  calledThroughTie: decided.filter((a) => a.noClearThree && a.calls > 0).length,
  stoppedAtName: asks.filter((a) => !a.decided && a.calls === 0).length, blocked: asks.filter((a) => a.blocked).length,
  distinctSeeds: distinct.length, currentVersionSeeds: seeds.length,
};
console.log(counts);
console.log(`current-version seeds (${seeds.length}): ${seeds.map((s) => s.name).join(", ")}`);

let looks: Record<string, number> | null = null;
if (process.argv.includes("--looks")) {
  const done = (await Promise.all(seeds.map((s) => secondLook.peek({ ask: s.body })))).filter((e): e is LookEvent[] => !!e);
  const last = done.map((e) => e.findLast((x) => x.type === "look") as Extract<LookEvent, { type: "look" }>);
  looks = { looked: last.length, measured: last.filter((l) => l.measured).length, kept: last.filter((l) => l.outcome === "kept").length, changed: last.filter((l) => l.outcome === "changed").length, declined: last.filter((l) => l.outcome === "declined").length, blocked: last.filter((l) => l.outcome === "blocked").length, checkFed: last.filter((l) => l.checkFed).length, citedLess: last.filter((l) => l.citedLess).length };
  console.log("second looks:", looks);
}
writeFileSync("audit/forks.json", JSON.stringify({ countedAt: new Date().toISOString().slice(0, 10), counts, seeds, looks }, null, 2) + "\n");
process.exit(0);
