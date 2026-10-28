// Historical replay, stage 1 of 2 (Oct 13; protocol in audit/replay-protocol.md). Builds each case's eight-name
// list WITHOUT reading any affinity: resolve seed and real partner by exact name (brand only, the audit's identity
// rule), take the partner's most specific Qloo genre tag, list brands under that tag (no signal), and keep the seven
// whose Qloo popularity sits closest to the partner's, excluding the seed. A case is dropped, as the protocol says,
// when a name doesn't confirm or the tag holds fewer than seven other brands.
// Writes audit/replay.json (names, ids, tag, popularity to two decimals). No affinity is fetched here.
//   QLOO_DAILY_CAP=<n> node --env-file=.env.local scripts/replay-build.ts audit/replay-cases.json [audit/replay.json]
import { readFileSync, writeFileSync } from "node:fs";
import { insights, search, qlooCallCount, type Entity } from "../lib/qloo.ts";
import { resolve } from "../lib/resolve.ts";
import { identityOf } from "../lib/review.ts";

const BRAND = "urn:entity:brand";
type Case = { seed: string; partner: string; year: number; what: string; source: string };
const cases: Case[] = JSON.parse(readFileSync(process.argv[2] ?? "audit/replay-cases.json", "utf8"));
const two = (v: number) => Math.round(v * 100) / 100;

async function confirm(name: string): Promise<Entity | string> {
  const id = identityOf(name, await resolve(name, (await search(name, [BRAND], 5)) as Entity[]));
  if (id.state !== "confirmed") return `${id.state}${id.state === "ambiguous" ? `: ${id.options.map((o) => o.name).join(" / ")}` : ""}`;
  const [card] = await insights({ "filter.type": BRAND, "filter.results.entities": id.entity.entity_id, take: 1 }); // = getCard's key
  return card ?? "no card";
}

const out = [];
for (const c of cases) {
  const seed = await confirm(c.seed);
  const partner = await confirm(c.partner);
  if (typeof seed === "string" || typeof partner === "string") {
    out.push({ ...c, dropped: `name did not confirm: ${typeof seed === "string" ? `${c.seed} (${seed})` : ""} ${typeof partner === "string" ? `${c.partner} (${partner})` : ""}`.trim() });
    continue;
  }
  const tag = partner.tags.filter((t) => t.tag_id.startsWith("urn:tag:genre:brand:")).sort((a, b) => b.tag_id.split(":").length - a.tag_id.split(":").length)[0];
  if (!tag) { out.push({ ...c, dropped: `${c.partner} has no brand genre tag` }); continue; }
  const pool = (await insights({ "filter.type": BRAND, "filter.tags": tag.tag_id, take: 50 })).filter((e) => e.entity_id !== seed.entity_id && e.entity_id !== partner.entity_id);
  if (pool.length < 7) { out.push({ ...c, dropped: `tag ${tag.name} holds ${pool.length} other brands` }); continue; }
  const decoys = pool.sort((a, b) => Math.abs(a.popularity - partner.popularity) - Math.abs(b.popularity - partner.popularity)).slice(0, 7);
  out.push({
    ...c,
    seedId: seed.entity_id, seedMatched: seed.name,
    partnerId: partner.entity_id, partnerMatched: partner.name, partnerPopularity: two(partner.popularity),
    tag: { id: tag.tag_id, name: tag.name },
    decoys: decoys.map((d) => ({ name: d.name, id: d.entity_id, popularity: two(d.popularity) })),
  });
  console.log(`${c.seed} x ${c.partner}: tag ${tag.name}; decoys ${decoys.map((d) => `${d.name} ${two(d.popularity)}`).join(", ")} (partner ${two(partner.popularity)})`);
}
for (const d of out.filter((x) => "dropped" in x)) console.log(`DROPPED ${d.seed} x ${d.partner}: ${(d as { dropped: string }).dropped}`);
writeFileSync(process.argv[3] ?? "audit/replay.json", JSON.stringify({ stage: "built, not scored", builtAt: new Date().toISOString().slice(0, 10), cases: out }, null, 2) + "\n");
console.log(`\n${out.filter((x) => !("dropped" in x)).length} of ${cases.length} cases built. Qloo calls: ${qlooCallCount()}`);
