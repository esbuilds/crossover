// Scrambled-seed control, input to the draw (audit/replay-control-protocol.md): each replay seed's own Qloo tags, read
// from the cached search the replay build already made. Peek only: never a Qloo call; a seed not in the cache is null.
//   node --env-file=.env.local scripts/replay-control-tags.ts
import { readFileSync, writeFileSync } from "node:fs";
import { search, qlooCallCount, type Entity } from "../lib/qloo.ts";

type Case = { seed: string; seedId: string; result?: { state?: string } };
const cases: Case[] = ["audit/replay.json", "audit/replay-v2.json"].flatMap((f) => JSON.parse(readFileSync(f, "utf8")).cases).filter((c: Case) => c.result?.state === "scored");
const out: Record<string, string[] | null> = {};
for (const c of cases) {
  const hit = ((await search.peek(c.seed, ["urn:entity:brand"], 5)) as Entity[] | null)?.find((e) => e.entity_id === c.seedId);
  out[c.seedId] = hit ? hit.tags.map((t) => t.tag_id) : null;
  console.log(`${c.seed}: ${hit ? hit.tags.map((t) => t.name).join(", ") : "not cached"}`);
}
writeFileSync("audit/replay-control-seed-tags.json", JSON.stringify(out, null, 2) + "\n");
console.log(`Qloo calls: ${qlooCallCount()}`);
process.exit(0);
