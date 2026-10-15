// Routes the agent took (Fable's destroy brief 2d, real Oct 15): every cached ask in Redis (cx:ask:*, all prompt
// versions), its route as the tools it called in order plus the candidates' source, and whether it stopped before a call.
// Zero Qloo and model calls; reads Redis only. Prints the /audit sentence's numbers.
//   node --env-file=.env.local scripts/routes.ts
import { stepsFrom } from "../lib/ask/steps.ts";
import type { AskEvent } from "../lib/ask/agent.ts";

const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
if (!url || !token) throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are required");
const run = async (commands: (string | number)[][]) => {
  const res = await fetch(`${url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(commands) });
  return ((await res.json()) as { result?: unknown }[]).map((r) => r.result);
};

const keys: string[] = [];
let cursor = "0";
do {
  const [[next, batch]] = (await run([["SCAN", cursor, "MATCH", "cx:ask:*", "COUNT", 1000]])) as [string, string[]][];
  cursor = next;
  keys.push(...batch);
} while (cursor !== "0");

const routes = new Map<string, number>();
let stopped = 0, asks = 0;
for (const k of keys) {
  const [raw] = (await run([["GET", k]])) as (string | null)[];
  const v = raw ? (JSON.parse(raw) as { trace?: string[] }) : null;
  if (!v?.trace) continue;
  const events = v.trace.map((s) => JSON.parse(s)) as AskEvent[];
  const steps = stepsFrom(events);
  if (!steps.length) continue;
  asks++;
  const src = (steps.find((s) => s.tool === "candidates")?.output as { source?: string } | undefined)?.source;
  const d = events.findLast((e) => e.type === "decision");
  const calls = d && d.type === "decision" ? d.decision?.calls.length ?? 0 : 0;
  if (!calls) stopped++;
  const route = steps.map((s) => (s.tool === "candidates" && src ? `candidates(${src})` : s.tool)).join(" > ") + (calls ? "" : " > stop");
  routes.set(route, (routes.get(route) ?? 0) + 1);
}
for (const [r, n] of [...routes].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${r}`);
console.log(`\nAcross ${asks} cached asks the agent took ${routes.size} distinct routes; ${stopped} stopped before a call.`);
