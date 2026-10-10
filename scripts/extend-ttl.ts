// Push every cached response's expiry to a fixed date (Oct 11 brief, item 4): judging runs to Nov 16 and cache keys
// written in early October would lapse around Nov 9. Zero Qloo calls: it only touches Redis key expiries.
// Skips the counters (cx:count:*, which includes the per-IP brief cap) and shared state (cx:qloo:*).
// Run after every warm pass, and again on Oct 27 after the final one (docs/recording-runbook.md).
//
//   node --env-file=.env.local scripts/extend-ttl.ts [2026-12-01T00:00:00Z]
export {}; // a module, for top-level await
const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
if (!url || !token) throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are required");
const until = Date.parse(process.argv[2] ?? "2026-12-01T00:00:00Z");
if (!Number.isFinite(until) || until < Date.now()) throw new Error("the date must be in the future");

async function run(commands: (string | number)[][]) {
  const res = await fetch(`${url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(commands) });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return ((await res.json()) as { result?: unknown; error?: string }[]).map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

const skip = (k: string) => k.startsWith("cx:count:") || k.startsWith("cx:qloo:");
let cursor = "0";
let extended = 0;
let skipped = 0;
const byName: Record<string, number> = {};
do {
  const [[next, keys]] = (await run([["SCAN", cursor, "MATCH", "cx:*", "COUNT", 1000]])) as [string, string[]][];
  cursor = next;
  const mine = keys.filter((k) => !skip(k));
  skipped += keys.length - mine.length;
  if (mine.length) {
    const results = await run(mine.map((k) => ["PEXPIREAT", k, until]));
    extended += results.filter((r) => r === 1).length;
    for (const k of mine) byName[k.split(":")[1]] = (byName[k.split(":")[1]] ?? 0) + 1;
  }
} while (cursor !== "0");

console.log(`extended ${extended} keys to ${new Date(until).toISOString()}; skipped ${skipped} counter/state keys`);
console.log(Object.entries(byName).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(", "));
