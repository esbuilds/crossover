// One-off: record /search results for the 20 probe brands into fixtures/search.json.
// 20 Qloo calls. Run only when the fixture needs refreshing:
//   node --env-file=.env.local scripts/record-fixtures.ts
// Strips each candidate to identifiers (name, entity_id, types) plus two facts our code derives from popularity
// (lib/fixture-facts.ts): no Qloo numbers, descriptions, tags or images in the repo (FIXTURE_KEYS in resolve.test).
import { readFileSync, writeFileSync } from "node:fs";
import { search, qlooCallCount, RESOLVE_TYPES } from "../lib/qloo.ts";
import { derive } from "../lib/fixture-facts.ts";

const brands = readFileSync(new URL("../fixtures/brands.txt", import.meta.url), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const out: Record<string, unknown[]> = {};
for (const b of brands) {
  const hits = await search(b, RESOLVE_TYPES, 5);
  out[b] = derive(b, hits);
}
writeFileSync(new URL("../fixtures/search.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`${brands.length} brands recorded, ${qlooCallCount()} Qloo calls`);
