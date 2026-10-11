// Rivals (rivals-v1, wow brief Oct 11; probe/VERIFY-4.md). Two seeds, both seeds' top 50 brands, the union scored under
// each seed in the same call shape, split by the review GAP: leans A, leans B, shared. Brands only.
// Copy rules live in the brief: "sits closer to A", never "prefers"; no audience labels; no counts.
import { insights, compareTags, heatmap, type Entity } from "./qloo.ts";
import { rankMetros, type City } from "./cities.ts";
import { collide, type Collision } from "./collide.ts";
import { incr, today } from "./redis.ts";
import { applyMissingRule, GAP } from "./review.ts";

export const RIVALS_VERSION = "rivals-v1";
const BRAND = "urn:entity:brand";
const BATCH = 50; // Qloo's take ceiling: a 100-name union is two calls per seed (VERIFY-4)
const EPS = 1e-9; // 0.85 - 0.8 is 0.04999... in floating point; "0.05 or more" means 0.05 counts
const MIN_SHARED = 3; // under this the page is two lists and says the audiences barely overlap

export type Seed = { entity_id: string; name: string; type: string; kind: string[] };
export type Lean = "a" | "b" | "shared" | "no data";
export type RivalRow = { id: string; name: string; kind: string[]; a: number | null; b: number | null; lean: Lean; rankA: number | null; rankB: number | null };
export type Rivals = {
  version: string;
  a: Seed;
  b: Seed;
  leansA: RivalRow[];
  leansB: RivalRow[];
  shared: RivalRow[];
  // the seeds' own field (other baseball clubs for the Dodgers): kept, but out of the columns (VERIFY-4 finding 4)
  sameField: RivalRow[];
  noData: RivalRow[];
  layout: "three" | "two";
};
type Scored = { entity_id: string; affinity?: number };

// a brand's fields: its second-level genre tags (urn:tag:genre:brand:sports_organization:baseball,
// ...:food_and_beverage:drinks). The top level was too broad: food_and_beverage took 57 of Olipop vs Poppi's 89.
// ponytail: tags are trimmed to 12 per entity, so a brand whose genre tag sits past the cut (Juventus) slips through
// to the columns; read untrimmed tags if that shows up on a prepared pair.
const fields = (e: Entity) =>
  new Set(e.tags.map((t) => t.tag_id).filter((t) => t.startsWith("urn:tag:genre:brand:")).filter((t) => t.split(":").length >= 6).map((t) => t.split(":").slice(0, 6).join(":")));

// what an entity is, in Qloo's own genre tag names, most specific first ("Energy Drink", "Drinks"; "Indie Folk" for an
// artist seed). Used instead of
// Qloo's short descriptions, which name who a brand is for ("busy women", "toddler foods"); the page carries no
// audience words (brief-oct13-vs copy rules).
const kindOf = (e: Entity) =>
  e.tags
    .filter((t) => t.tag_id.startsWith("urn:tag:genre:"))
    .sort((x, y) => y.tag_id.split(":").length - x.tag_id.split(":").length)
    .slice(0, 2)
    .map((t) => t.name);

export function compareLists(a: Entity, b: Entity, listA: Entity[], listB: Entity[], scoresA: Scored[], scoresB: Scored[]): Rivals {
  const rankIn = (list: Entity[]) => new Map(list.map((e, i) => [e.entity_id, i + 1]));
  const [rankA, rankB] = [rankIn(listA), rankIn(listB)];
  const byId = new Map([...listA, ...listB].map((e) => [e.entity_id, e]));
  const union = [...byId.keys()].filter((id) => id !== a.entity_id && id !== b.entity_id);
  const valueIn = (s: Scored[]) => new Map(s.map((x) => [x.entity_id, x.affinity]));
  const [va, vb] = [valueIn(scoresA), valueIn(scoresB)];
  // missing rule (review-v1) within each scoring call, then across the two seeds for each candidate
  const [ca, cb] = [applyMissingRule(union.map((id) => va.get(id)), "one call"), applyMissingRule(union.map((id) => vb.get(id)), "one call")];
  const seedFields = new Set([...fields(a), ...fields(b)]);

  const seed = (e: Entity): Seed => ({ entity_id: e.entity_id, name: e.name, type: e.types.find((t) => t !== "urn:entity") ?? "", kind: kindOf(e) });
  const out: Rivals = { version: RIVALS_VERSION, a: seed(a), b: seed(b), leansA: [], leansB: [], shared: [], sameField: [], noData: [], layout: "three" };
  union.forEach((id, i) => {
    const [xa, xb] = applyMissingRule([va.get(id), vb.get(id)], "across signals");
    const A = ca[i].value !== null ? xa.value : null;
    const B = cb[i].value !== null ? xb.value : null;
    const lean: Lean = A === null || B === null ? "no data" : A - B >= GAP - EPS ? "a" : B - A >= GAP - EPS ? "b" : "shared";
    const e = byId.get(id)!;
    const row: RivalRow = { id, name: e.name, kind: kindOf(e), a: A, b: B, lean, rankA: rankA.get(id) ?? null, rankB: rankB.get(id) ?? null };
    if (lean === "no data") out.noData.push(row);
    else if ([...fields(e)].some((f) => seedFields.has(f))) out.sameField.push(row);
    else ({ a: out.leansA, b: out.leansB, shared: out.shared })[lean].push(row);
  });
  const gap = (r: RivalRow) => Math.abs(r.a! - r.b!);
  out.leansA.sort((x, y) => gap(y) - gap(x));
  out.leansB.sort((x, y) => gap(y) - gap(x));
  out.shared.sort((x, y) => y.a! + y.b! - (x.a! + x.b!));
  out.sameField.sort((x, y) => gap(y) - gap(x));
  out.layout = out.shared.length < MIN_SHARED ? "two" : "three";
  return out;
}

// Cold: 2 lists + 2 to 4 scoring calls (8 with heatmaps, added on map day). Serial, never fanned out against Qloo.
// peek: cache only, never a call; null when any piece is cold (the page counts a cold pair against the visitor first).
export async function getRivals(a: Entity, b: Entity, peek = false): Promise<Rivals | null> {
  const get = (p: Record<string, string | number>) => (peek ? insights.peek(p) : insights(p));
  const listA = await get({ "filter.type": BRAND, "signal.interests.entities": a.entity_id, take: 50 }); // = fansTop50's key
  const listB = listA && (await get({ "filter.type": BRAND, "signal.interests.entities": b.entity_id, take: 50 }));
  if (!listA || !listB) return null;
  const union = [...new Map([...listA, ...listB].map((e) => [e.entity_id, e])).keys()].filter((id) => id !== a.entity_id && id !== b.entity_id);
  const score = async (seed: string) => {
    const out: Scored[] = [];
    for (let i = 0; i < union.length; i += BATCH) {
      const chunk = union.slice(i, i + BATCH);
      const hits = await get({ "filter.type": BRAND, "signal.interests.entities": seed, "filter.results.entities": chunk.join(","), take: chunk.length });
      if (!hits) return null;
      out.push(...hits);
    }
    return out;
  };
  const sa = await score(a.entity_id);
  const sb = sa && (await score(b.entity_id));
  return sa && sb ? compareLists(a, b, listA, listB, sa, sb) : null;
}

// --- the page's loader (brief-oct13-vs): cards, rivals, compare tags; warm from cache or one counted cold run ---
// map null: a person seed (flat heatmaps, VERIFY-4 Cedric), so no heatmap calls and the page says so
export type VsMap = Collision & { metrosA: City[]; metrosB: City[] };
export type VsData = { a: Entity; b: Entity; rivals: Rivals; share: string[]; map: VsMap | null };
export type Side = { id: string; type: string };
export class ColdPairCap extends Error {}
const COLD_PAIRS_PER_IP = 10; // per UTC day; a cold pair is 8 to 11 Qloo calls (VERIFY-4, plus the compare chip)

async function spendColdPair(ip: string) {
  const n = await incr(`cx:count:vs:${ip}:${today()}`, 60 * 60 * 48);
  if ((n ?? 0) > (ip === "warm" ? 200 : COLD_PAIRS_PER_IP)) throw new ColdPairCap();
}

// null: Qloo doesn't know one of the ids. Cold pieces cost the visitor one of their cold pairs, once, before any call.
export async function loadVs(sa: Side, sb: Side, ip: string): Promise<VsData | null> {
  const run = async (peek: boolean): Promise<VsData | null | "cold"> => {
    const card = async (s: Side) => {
      const p = { "filter.type": s.type, "filter.results.entities": s.id, take: 1 }; // = getCard's key
      const hits = peek ? await insights.peek(p) : await insights(p);
      return hits === null ? "cold" : (hits[0] ?? null);
    };
    const a = await card(sa);
    if (a === null) return null;
    const b = await card(sb);
    if (b === null) return null;
    if (a === "cold" || b === "cold") return "cold";
    const rivals = await getRivals(a, b, peek);
    if (!rivals) return "cold";
    // the compare chip is garnish: a failed call leaves it off instead of failing the page
    const share = peek ? await compareTags.peek(a.entity_id, b.entity_id) : await compareTags(a.entity_id, b.entity_id).catch(() => []);
    let map: VsMap | null = null;
    if (![a, b].some((e) => e.types.includes("urn:entity:person"))) {
      const heat = (id: string) => (peek ? heatmap.peek(id, "United States") : heatmap(id, "United States")); // = getCities' key
      const ha = await heat(a.entity_id);
      const hb = ha && (await heat(b.entity_id));
      if (!ha || !hb) return "cold";
      map = { ...collide(ha, hb), metrosA: rankMetros(ha).slice(0, 5), metrosB: rankMetros(hb).slice(0, 5) };
    }
    // a pair warmed before the chip existed stays warm: a cold chip never makes the page cold
    return { a, b, rivals, share: (share ?? []).slice(0, 4), map };
  };
  const warm = await run(true);
  if (warm !== "cold") return warm;
  await spendColdPair(ip);
  const live = await run(false);
  return live === "cold" ? null : live;
}
