// City probe (Perplexity re-judge moonshot 3, real Oct 13): does a location signal change Pick three? Mt. Joy's eight
// scored nationally (cached) and with signal.location.query per metro. Gate (set before the run): the top three by
// affinity changes in at least 2 of 4 metros. 4 calls, serial.
//   node --env-file=.env.local scripts/city-probe.ts
import { insights, qlooCallCount } from "../lib/qloo.ts";
import { CASES } from "../lib/review-cases.ts";

const c = CASES.find((x) => x.key === "mt-joy")!;
const ids = c.names.map((n) => n.id).join(",");
const name = new Map(c.names.map((n) => [n.id, n.name]));
const top = async (extra: Record<string, string>) => {
  const hits = await insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": c.seed.id, "filter.results.entities": ids, take: 8, ...extra });
  return hits.sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).map((h) => `${name.get(h.entity_id)} ${h.affinity?.toFixed(2)}`);
};
const national = await top({});
console.log(`national: ${national.join(", ")}`);
let changed = 0;
for (const metro of ["Denver", "Miami", "Austin", "New York"]) {
  const t = await top({ "signal.location.query": metro });
  const differs = t.slice(0, 3).map((x) => x.split(" ")[0]).sort().join() !== national.slice(0, 3).map((x) => x.split(" ")[0]).sort().join();
  if (differs) changed++;
  console.log(`${metro}: ${t.join(", ")}${differs ? "  <- top three changed" : ""}`);
}
console.log(`\nGATE: top three changed in ${changed} of 4 metros (need 2). Qloo calls: ${qlooCallCount()}`);
