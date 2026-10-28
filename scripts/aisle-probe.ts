// Any-aisle probe: for a typed category, the brand tag whose name matches best,
// then the top brands under it. Gate: at least 4 of 5 categories give 8+ brands a partnerships person would recognise,
// no wrong-type entities. 2 calls per category (tag search, list), serial.
//   node --env-file=.env.local scripts/aisle-probe.ts
import { insights, tagSearch } from "../lib/qloo.ts";
import { tokens } from "../lib/resolve.ts";

const TYPED = ["running shoes", "hard seltzer", "streaming services", "fast-casual burgers", "skincare"];
const score = (q: string, name: string) => {
  const a = tokens(q), b = tokens(name);
  const shared = a.filter((t) => b.some((u) => u.startsWith(t.replace(/s$/, "")) || t.startsWith(u.replace(/s$/, "")))).length;
  return shared / Math.max(a.length, b.length);
};
for (const q of TYPED) {
  const tags = (await tagSearch(q, "urn:entity:brand")) as { id: string; name: string; type?: string }[];
  const ranked = tags.map((t) => ({ ...t, s: score(q, t.name) })).sort((x, y) => y.s - x.s);
  const pick = ranked[0];
  console.log(`\n## ${q}: ${tags.length} tags; best "${pick?.name}" (${pick?.id}, match ${pick?.s.toFixed(2)}); next: ${ranked.slice(1, 4).map((t) => t.name).join(", ")}`);
  if (!pick) continue;
  const hits = await insights({ "filter.type": "urn:entity:brand", "filter.tags": pick.id, take: 12 });
  console.log(`${hits.length} brands: ${hits.map((h) => `${h.name} (${h.popularity.toFixed(2)})`).join(", ")}`);
}
