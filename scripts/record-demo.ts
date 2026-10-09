// One-off: record resolve + slate + heatmap for the four demo entities into fixtures/demo/ (gitignored:
// it holds Qloo response data, which PLAN.md says never to commit). 8 Qloo calls per entity, 32 total.
//   node --env-file=.env.local scripts/record-demo.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { search, heatmap, qlooCallCount, RESOLVE_TYPES } from "../lib/qloo.ts";
import { resolve } from "../lib/resolve.ts";
import { getSlate } from "../lib/slate.ts";

const DEMO = ["Liquid Death", "Olipop", "Mt. Joy", "Somebody Feed Phil"];
const dir = new URL("../fixtures/demo/", import.meta.url);
mkdirSync(dir, { recursive: true });

for (const q of DEMO) {
  const candidates = await search(q, RESOLVE_TYPES, 5);
  const resolution = await resolve(q, candidates);
  if (resolution.status !== "confident") {
    console.log(`${q}: ${resolution.status}, skipped`);
    continue;
  }
  const id = resolution.match.entity_id;
  const [slate, cells] = await Promise.all([getSlate(id), heatmap(id, "United States")]);
  const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
  writeFileSync(new URL(`${slug}.json`, dir), JSON.stringify({ query: q, candidates, resolution, slate, heatmap: cells }) + "\n");
  console.log(`${q} -> ${resolution.match.name} (${resolution.match.types[0]}), ${cells.length} cells`);
}
console.log(`${qlooCallCount()} Qloo calls`);
