// The frozen answers' fingerprints (docs/freeze.md): sha1 of each prepared ask's cached events, from the cache only.
//   node --env-file=.env.local scripts/ask-hashes.ts
import { createHash } from "node:crypto";
import { peekAsk } from "../lib/ask/agent.ts";
const asks = [["Allbirds", { id: "78A44C09-E691-42DA-A553-5CDE6EE9B18A", type: "urn:entity:brand" }], ["Mt. Joy", { id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: "urn:entity:artist" }], ["Coca-Cola x Converse (replay)", { id: "A539C8C9-4733-41A9-911A-11AC2B6D475A", type: "urn:entity:brand", caseKey: "coca-cola-x-converse" }]] as const;
for (const [label, body] of asks) {
  const ev = await peekAsk(body);
  const d = ev?.findLast((e) => e.type === "decision");
  console.log(`| ${label} | ${ev ? createHash("sha1").update(JSON.stringify(ev)).digest("hex") : "NOT CACHED"} | ${d && d.type === "decision" ? (d.decision?.calls.map((c) => c.name.replace(/\[\[|\]\]/g, "")).join(", ") ?? "") : ""} | ${d && d.type === "decision" ? (d.check.ok ? "ok" : "blocked") : ""} |`);
}
