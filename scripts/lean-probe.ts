// Lean probe (Fable's markets ruling, real Oct 15): the split map's own diff (lib/collide.ts), candidate against Allbirds,
// for the agent's three, on cached heatmaps (0 calls). Gate written in research/brief-oct15-markets-ruling.md before the run:
// each of the three has cells leaning its way; the three counts are not all within 10% of each other; each one's leaning
// cells name at least one metro outside Allbirds' own top eight (the 127 block).
//   node --env-file=.env.local scripts/lean-probe.ts
import { heatmap } from "../lib/qloo.ts";
import { collide } from "../lib/collide.ts";
import { getCities, marketOf } from "../lib/cities.ts";

const SEED = "78A44C09-E691-42DA-A553-5CDE6EE9B18A";
const ab = (await import(new URL("../lib/ask/fixtures/allbirds.json", import.meta.url).href, { with: { type: "json" } })).default as { type: string; output?: { candidates?: { name: string; id: string }[] } }[];
const three = ab.find((e) => e.type === "result" && e.output?.candidates)!.output!.candidates!.slice(0, 3);

const seedTop8 = (await getCities(SEED)).metros.slice(0, 8).map((m) => m.name);
const seedCells = await heatmap(SEED, "United States");
console.log(`Allbirds top eight: ${seedTop8.join(", ")}\n`);

const rows = [];
for (const c of three) {
  const col = collide(await heatmap(c.id, "United States"), seedCells);
  const metros = new Map<string, number>();
  for (const [lat, lon, tone] of col.cells) if (tone === "a") { const m = marketOf(lat, lon)?.name; if (m) metros.set(m, (metros.get(m) ?? 0) + 1); }
  const named = [...metros].sort((x, y) => y[1] - x[1]);
  const outside = named.filter(([m]) => !seedTop8.includes(m));
  rows.push({ name: c.name, lean: col.counts.a, outside: outside.length });
  console.log(`${c.name}: ${col.counts.a} cells lean its way, ${col.counts.b} Allbirds', ${col.counts.both} both (of ${col.cells.length} drawn)`);
  console.log(`  leaning metros: ${named.slice(0, 10).map(([m, n]) => `${m} ${n}`).join(", ") || "none in a named market"}`);
  console.log(`  outside Allbirds' top eight: ${outside.slice(0, 6).map(([m, n]) => `${m} ${n}`).join(", ") || "none"}\n`);
}
const g1 = rows.every((r) => r.lean > 0);
const [lo, hi] = [Math.min(...rows.map((r) => r.lean)), Math.max(...rows.map((r) => r.lean))];
const g2 = hi > lo * 1.1;
const g3 = rows.every((r) => r.outside > 0);
console.log(`GATE 1 each leans somewhere: ${g1 ? "PASS" : "FAIL"}`);
console.log(`GATE 2 counts not all within 10% (${lo} to ${hi}): ${g2 ? "PASS" : "FAIL"}`);
console.log(`GATE 3 each names a metro outside the 127 block: ${g3 ? "PASS" : "FAIL"}`);
console.log(`OVERALL: ${g1 && g2 && g3 ? "PASS" : "FAIL"}`);
