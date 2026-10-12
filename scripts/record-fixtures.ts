// One-off: record /search results for the 20 probe brands into fixtures/search.json.
// 20 Qloo calls. Run only when the fixture needs refreshing:
//   node --env-file=.env.local scripts/record-fixtures.ts
// Strips each candidate to identifiers (name, entity_id, types) plus popularity, which the resolver's floor and
// person/artist tiebreak read. No descriptions, tags or images: Qloo's content stays out of the repo (FIXTURE_KEYS).
import { readFileSync, writeFileSync } from "node:fs";
import { search, qlooCallCount, RESOLVE_TYPES } from "../lib/qloo.ts";

const brands = readFileSync(new URL("../fixtures/brands.txt", import.meta.url), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const out: Record<string, unknown[]> = {};
for (const b of brands) {
  const hits = await search(b, RESOLVE_TYPES, 5);
  out[b] = hits.map(({ name, entity_id, types, popularity }) => ({ name, entity_id, types, popularity }));
}
writeFileSync(new URL("../fixtures/search.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`${brands.length} brands recorded, ${qlooCallCount()} Qloo calls`);
