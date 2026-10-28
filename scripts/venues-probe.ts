// "Where to start" probe: for each prepared ask, venues in the lead market that both
// the seed's and the first call's fans favor (the brief's own venue params: restaurants and bars, plus live music for
// artists, both entities as signals). Gate set before the run: every ask returns at least 3 venues located in the named
// city, none a national chain (a name that also comes back in another market counts as a chain). About 10 calls.
//   QLOO_DAILY_CAP=<n> node --env-file=.env.local scripts/venues-probe.ts
import { insights, placeTag } from "../lib/qloo.ts";
import { getCities } from "../lib/cities.ts";

const CASES = [
  { label: "Allbirds + Bombas", seed: "78A44C09-E691-42DA-A553-5CDE6EE9B18A", artist: false, pick: "Bombas", market: "San Francisco" },
  { label: "Mt. Joy + Outdoor Voices", seed: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", artist: true, pick: "Outdoor Voices", market: null as string | null },
  { label: "Coca-Cola + Converse", seed: "A539C8C9-4733-41A9-911A-11AC2B6D475A", artist: false, pick: "Converse", market: null as string | null },
];
const PICK_IDS: Record<string, string> = { Bombas: "", "Outdoor Voices": "011DFDA5-F5A7-461A-9D96-E28E4964E7FB", Converse: "7FFF01CF-7B0E-405A-A232-14176B165E60" };
// Bombas' id from Allbirds' frozen answer
const ab = (await import(new URL("../lib/ask/fixtures/allbirds.json", import.meta.url).href, { with: { type: "json" } })).default as { type: string; output?: { candidates?: { name: string; id: string }[] } }[];
PICK_IDS.Bombas = ab.find((e) => e.type === "result" && e.output?.candidates)!.output!.candidates!.find((c) => c.name === "Bombas")!.id;

const music = await placeTag("live music venue").catch(() => null);
const seen = new Map<string, string[]>();
const results = [];
for (const c of CASES) {
  const market = c.market ?? (await getCities(c.seed)).metros[0]?.name;
  const tags = ["urn:tag:category:place:restaurant", "urn:tag:category:place:bar", ...(c.artist && music ? [music.tag_id] : [])];
  const lists = [];
  for (const tag of tags) lists.push(await insights({ "filter.type": "urn:entity:place", "filter.location.query": market, "filter.tags": tag, take: 8, "signal.interests.entities": `${c.seed},${PICK_IDS[c.pick]}` }).catch(() => []));
  const venues = lists.flat().filter((v, i, all) => all.findIndex((x) => x.entity_id === v.entity_id) === i).sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0)).slice(0, 6);
  for (const v of venues) seen.set(v.name, [...(seen.get(v.name) ?? []), market]);
  results.push({ c, market, venues });
}
let pass = 0;
for (const { c, market, venues } of results) {
  const inCity = venues.filter((v) => (v.city ?? "").toLowerCase().includes(market.toLowerCase().split(" ")[0]) || (v.address ?? "").toLowerCase().includes(market.toLowerCase().split(" ")[0]));
  const chains = venues.filter((v) => (seen.get(v.name) ?? []).length > 1);
  const ok = inCity.length >= 3 && chains.length === 0;
  if (ok) pass++;
  console.log(`\n## ${c.label} in ${market}: ${venues.length} venues, ${inCity.length} in the city, ${chains.length} chains -> ${ok ? "PASS" : "FAIL"}`);
  for (const v of venues) console.log(`  ${v.name} | ${v.city ?? "?"} | ${v.address ?? "?"} | ${(v.affinity ?? 0).toFixed(2)} | ${v.tags.slice(0, 3).map((t) => t.name).join(", ")}`);
}
console.log(`\nGATE: ${pass} of 3 asks pass (need 3).`);
