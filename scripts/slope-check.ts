// The slopegraph against the table for every cached ask: each drawn label must equal the
// table cell it stands for. Reads Redis only (the asks and their cached reverse reads): zero Qloo and model calls.
//   node --env-file=.env.local scripts/slope-check.ts
import { bothWays } from "../lib/ask/both-ways.ts";
import { cell, slope } from "../lib/ask/both-rules.ts";
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

let asks = 0, drawn = 0, cold = 0;
const bad: string[] = [];
for (const k of keys) {
  const [raw] = (await run([["GET", k]])) as (string | null)[];
  const v = raw ? (JSON.parse(raw) as { trace?: string[] }) : null;
  if (!v?.trace) continue;
  asks++;
  const b = await bothWays(v.trace.map((s) => JSON.parse(s)) as AskEvent[], null);
  if (!b) { cold++; continue; }
  const s = b.shown ? slope(b) : null;
  if (!s) continue;
  drawn++;
  const rows = b.rows.filter((r) => typeof r.fwd === "number" && r.rev !== null);
  s.rows.forEach((r, i) => {
    const t = rows[i];
    if (r.name !== t.name || r.left !== cell(t.fwd) || (r.right ? r.right !== cell(t.rev) : t.rev !== "out")) bad.push(`${b.seed}: ${r.name} ${r.left}/${r.right} vs ${cell(t.fwd)}/${cell(t.rev)}`);
  });
}
console.log(`${asks} cached asks; ${drawn} draw a slopegraph; ${cold} have no cached reverse reads (no table, no picture); ${bad.length} label mismatches`);
for (const x of bad) console.log(x);
if (bad.length) process.exit(1);
