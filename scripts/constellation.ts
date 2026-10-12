// Warm and print the category constellations (brief-oct13-moonshots pick 1). Serial, through the cached client, so
// it reads and writes the shared production cache and counts every live call.
//   node --env-file=.env.local scripts/constellation.ts [slug]
import { CATEGORIES, getConstellation } from "../lib/constellation.ts";

for (const c of CATEGORIES.filter((c) => !process.argv[2] || c.slug === process.argv[2])) {
  const r = await getConstellation(c.slug);
  if (!r || r === "cold") throw new Error(`${c.slug}: ${r}`);
  console.log(`\n## ${r.title}  stress ${r.stress.toFixed(3)}  filled ${r.filled}  not measured: ${r.notMeasured.join(", ") || "none"}`);
  for (const d of r.dots) console.log(`${d.name.padEnd(16)} x ${d.x.toFixed(3).padStart(7)} y ${d.y.toFixed(3).padStart(7)} pop ${d.popularity?.toFixed(2)}`);
  for (const n of r.nearest) console.log(`${n.name.padEnd(16)} nearest: ${n.near.map((x) => `${x.name} ${x.affinity.toFixed(3)}`).join(", ")}`);
}
