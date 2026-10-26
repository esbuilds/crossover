// One-off: record /search results for the 20 probe brands into fixtures/demo/search.json (gitignored: Qloo data), then
// scripts/demo-search.ts writes the committed fixtures/search.json from it.
// 20 Qloo calls. Run only when the fixture needs refreshing:
//   node --env-file=.env.local scripts/record-fixtures.ts
// Strips each candidate to identifiers (name, entity_id, types) plus two facts our code derives from popularity
// (lib/fixture-facts.ts): no Qloo numbers, descriptions, tags or images in the repo (FIXTURE_KEYS in resolve.test).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
mkdirSync(new URL("../fixtures/demo/", import.meta.url), { recursive: true });
writeFileSync(new URL("../fixtures/demo/search.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`${brands.length} brands recorded, ${qlooCallCount()} Qloo calls`);
