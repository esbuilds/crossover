// One-off: record /search results for the 20 probe brands into fixtures/search.json.
// 20 Qloo calls. Run only when the fixture needs refreshing:
//   node --env-file=.env.local scripts/record-fixtures.ts
// Keeps only name, entity_id, types, popularity, short_description (safe to commit).
import { readFileSync, writeFileSync } from "node:fs";
import { search, qlooCallCount, RESOLVE_TYPES } from "../lib/qloo.ts";

const brands = readFileSync(new URL("../../probe/brands.txt", import.meta.url), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const out: Record<string, unknown[]> = {};
for (const b of brands) {
  const hits = await search(b, RESOLVE_TYPES, 5);
  out[b] = hits.map(({ name, entity_id, types, popularity, short_description }) => ({ name, entity_id, types, popularity, short_description }));
}
writeFileSync(new URL("../fixtures/search.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`${brands.length} brands recorded, ${qlooCallCount()} Qloo calls`);
