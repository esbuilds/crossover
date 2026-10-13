// Bridge probe (Perplexity moonshot 4, real Oct 13): a brand plus the audience it wants to reach, blended as weighted
// POST signals, brands out. Gate (set before the run): at 0.5/0.5 the top 10 is not swamped, meaning each seed drives
// at least 3 of the 10 (Qloo explainability, driven_by) and no more than 7 come from one seed's own top 50.
// Pass on 2 of 3 pairs. Weights 0.3/0.7 and 0.7/0.3 printed for the sweep. About 15 calls, serial.
//   node --env-file=.env.local scripts/bridge-probe.ts
import { insights, insightsPost, qlooCallCount } from "../lib/qloo.ts";

const BRAND = "urn:entity:brand";
const PAIRS = [
  [{ name: "Liquid Death", id: "4DF7C265-52D9-4A99-8803-F62C2302D561" }, { name: "Metallica", id: "C445C761-CB38-4FEE-B085-D35F444A04DF" }],
  [{ name: "Allbirds", id: "78A44C09-E691-42DA-A553-5CDE6EE9B18A" }, { name: "Mt. Joy", id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A" }],
  [{ name: "Olipop", id: "6647FB92-9390-4B58-885B-86D96FF5BB6D" }, { name: "Taylor Swift", id: "4BBEF799-A0C4-4110-AB01-39216993C312" }],
];
let passed = 0;
for (const [s, t] of PAIRS) {
  // = fansTop50's key, so warm seeds cost nothing
  const own = async (id: string) => new Set((await insights({ "filter.type": BRAND, "signal.interests.entities": id, take: 50 })).map((e) => e.entity_id));
  const [ownS, ownT] = [await own(s.id), await own(t.id)];
  console.log(`\n## ${s.name} + ${t.name}`);
  for (const w of [0.5, 0.3, 0.7]) {
    const hits = (await insightsPost(BRAND, [{ id: s.id, weight: w }, { id: t.id, weight: Number((1 - w).toFixed(1)) }], { take: 10, "feature.explainability": true })).slice(0, 10);
    const byS = hits.filter((h) => h.driven_by === s.id).length, byT = hits.filter((h) => h.driven_by === t.id).length;
    const inS = hits.filter((h) => ownS.has(h.entity_id)).length, inT = hits.filter((h) => ownT.has(h.entity_id)).length;
    const ok = byS >= 3 && byT >= 3 && inS <= 7 && inT <= 7;
    if (w === 0.5 && ok) passed++;
    const tag = (h: (typeof hits)[number]) => `${h.name}${h.driven_by === s.id ? " [s]" : h.driven_by === t.id ? " [t]" : ""}${ownS.has(h.entity_id) && ownT.has(h.entity_id) ? " (both top 50)" : ownS.has(h.entity_id) ? " (s top 50)" : ownT.has(h.entity_id) ? " (t top 50)" : ""}`;
    console.log(`w ${s.name} ${w}: driven ${byS} by ${s.name}, ${byT} by ${t.name}; in own top 50: ${inS} / ${inT}${w === 0.5 ? (ok ? " -> not swamped" : " -> SWAMPED") : ""}`);
    console.log(`  ${hits.map(tag).join(", ")}`);
  }
}
console.log(`\nGATE: ${passed} of 3 pairs not swamped at 0.5 (need 2). Qloo calls: ${qlooCallCount()}`);
