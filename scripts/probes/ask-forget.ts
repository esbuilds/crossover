// A one-off probe, run by hand and kept as the record of how its result was made; nothing in the app imports it.
// Forget one cached ask so it re-runs under current code, without moving any other ask's key (the cache version stays,
// so every other cached answer is byte-identical). Used for the Oct 14 Allbirds re-audition after the split fallback.
//   node --env-file=.env.local scripts/probes/ask-forget.ts <id> <type>     prints the key and DEL's result
import { createHash } from "node:crypto";
import { ASK_TOOLS, ASK_VERSION } from "../../lib/ask/agent.ts";

const [id, type] = process.argv.slice(2);
if (!id || !type) throw new Error("usage: scripts/probes/ask-forget.ts <id> <type>");
// the same key lib/qloo.ts cached() builds for streamCache("ask", version, ...) on run(version, input)
const key = `cx:ask:${createHash("sha1").update(JSON.stringify([`${ASK_VERSION}+${ASK_TOOLS}`, { id: id.toUpperCase(), type }])).digest("hex")}`;
const res = await fetch(`${process.env.KV_REST_API_URL}/pipeline`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify([["EXISTS", key], ["DEL", key]]),
});
console.log(key, JSON.stringify(await res.json()));
