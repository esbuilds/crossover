// X-ray probe: does the rivals split hold outside brands? For each prepared pair,
// the same top-50-both-ways scoring as rivals (compareLists), per domain: artist, tv_show, movie, podcast.
// A domain splits when 10 or more names lean each way. Gate: 3 of 4 domains split on 2 of 3 pairs.
// About 6 calls per pair per domain, serial. Derived numbers only to stdout.
//   node --env-file=.env.local scripts/xray-probe.ts
import { insights, qlooCallCount, type Entity } from "../lib/qloo.ts";
import { compareLists } from "../lib/rivals.ts";

const B = "urn:entity:brand", AR = "urn:entity:artist";
const PAIRS = [
  [{ name: "Liquid Death", id: "4DF7C265-52D9-4A99-8803-F62C2302D561", type: B }, { name: "Celsius", id: "D64DC967-F529-4A3F-9F89-774CE5118EF4", type: B }],
  [{ name: "Olipop", id: "6647FB92-9390-4B58-885B-86D96FF5BB6D", type: B }, { name: "Poppi", id: "8D1C70F5-AECA-4309-8BBF-B2B5A5AEFE59", type: B }],
  [{ name: "Mt. Joy", id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: AR }, { name: "Noah Kahan", id: "0A8052C7-2F56-43B5-B133-F59F8F2917E0", type: AR }],
];
const DOMAINS = ["artist", "tv_show", "movie", "podcast"].map((d) => `urn:entity:${d}`);
const card = async (s: { id: string; type: string }) => (await insights({ "filter.type": s.type, "filter.results.entities": s.id, take: 1 }))[0] as Entity;

let pairsPassing = 0;
for (const [sa, sb] of PAIRS) {
  const [a, b] = [await card(sa), await card(sb)];
  let split = 0;
  console.log(`\n## ${sa.name} vs ${sb.name}`);
  for (const type of DOMAINS) {
    const listA = await insights({ "filter.type": type, "signal.interests.entities": a.entity_id, take: 50 });
    const listB = await insights({ "filter.type": type, "signal.interests.entities": b.entity_id, take: 50 });
    const union = [...new Map([...listA, ...listB].map((e) => [e.entity_id, e])).keys()].filter((id) => id !== a.entity_id && id !== b.entity_id);
    const score = async (seed: string) => {
      const out = [];
      for (let i = 0; i < union.length; i += 50) out.push(...(await insights({ "filter.type": type, "signal.interests.entities": seed, "filter.results.entities": union.slice(i, i + 50).join(","), take: union.slice(i, i + 50).length })));
      return out;
    };
    const r = compareLists(a, b, listA, listB, await score(a.entity_id), await score(b.entity_id));
    const ok = r.leansA.length >= 10 && r.leansB.length >= 10;
    if (ok) split++;
    const top = (rows: typeof r.leansA) => rows.slice(0, 3).map((x) => `${x.name} ${x.a?.toFixed(2)}/${x.b?.toFixed(2)}`).join(", ");
    console.log(`${type.replace("urn:entity:", "")}: union ${union.length}, ${r.leansA.length} / ${r.leansB.length} / ${r.shared.length} shared, ${r.noData.length} no data, ${r.sameField.length} same field -> ${ok ? "split" : "no split"}`);
    console.log(`  ${sa.name}: ${top(r.leansA)}`);
    console.log(`  ${sb.name}: ${top(r.leansB)}`);
  }
  if (split >= 3) pairsPassing++;
  console.log(`${split} of 4 domains split`);
}
console.log(`\nGATE: ${pairsPassing} of 3 pairs with 3+ domains split (need 2). Qloo calls: ${qlooCallCount()}`);
