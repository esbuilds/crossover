// Age probe (brief-oct13-moonshots pick 2, gate): does the collision map change between Qloo's youngest and oldest
// brackets? Two prepared pairs, 24 and under vs 55 and over: 8 calls (national maps are cached). Serial.
// Pass: on one pair, at least 15% of cells leaned in both bracket maps flip side, and each bracket map keeps more
// than 70% of the brand's national cell count.
//   node --env-file=.env.local scripts/age-probe.ts
import { heatmap, heatmapAge } from "../lib/qloo.ts";
import { collide } from "../lib/collide.ts";

const PAIRS = [
  ["Olipop", "6647FB92-9390-4B58-885B-86D96FF5BB6D", "Poppi", "8D1C70F5-AECA-4309-8BBF-B2B5A5AEFE59"],
  ["Liquid Death", "4DF7C265-52D9-4A99-8803-F62C2302D561", "Celsius", "D64DC967-F529-4A3F-9F89-774CE5118EF4"],
];
const [YOUNG, OLD] = ["24_and_younger", "55_and_older"];
const US = "United States";

for (const [an, a, bn, b] of PAIRS) {
  const nat = { a: (await heatmap(a, US)).length, b: (await heatmap(b, US)).length };
  const maps: Record<string, Map<string, string>> = {};
  const kept: string[] = [];
  for (const age of [YOUNG, OLD]) {
    const [ha, hb] = [await heatmapAge(a, US, age), await heatmapAge(b, US, age)];
    kept.push(`${age}: ${an} ${ha.length} (${((100 * ha.length) / nat.a).toFixed(0)}%), ${bn} ${hb.length} (${((100 * hb.length) / nat.b).toFixed(0)}%)`);
    const col = collide(ha, hb);
    maps[age] = new Map(col.cells.map(([lat, lon, t]) => [`${lat},${lon}`, t]));
    kept.push(`  ${age} map: ${col.cells.length} drawn of ${col.matched} matched; leans ${an} ${col.counts.a}, ${bn} ${col.counts.b}, both ${col.counts.both}`);
  }
  let both = 0, flip = 0, changed = 0, common = 0;
  for (const [k, t] of maps[YOUNG]) {
    const u = maps[OLD].get(k);
    if (!u) continue;
    common++;
    if (t !== u) changed++;
    if (t !== "both" && u !== "both") {
      both++;
      if (t !== u) flip++;
    }
  }
  console.log(`\n## ${an} vs ${bn}`);
  for (const l of kept) console.log(l);
  console.log(`cells drawn in both bracket maps: ${common}; tone changed in ${changed} (${((100 * changed) / (common || 1)).toFixed(1)}%)`);
  console.log(`leaned in both: ${both}; flipped side: ${flip} (${((100 * flip) / (both || 1)).toFixed(1)}%)`);
}
