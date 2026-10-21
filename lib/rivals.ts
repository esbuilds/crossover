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
export const fields = (e: Entity) =>
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
  // a seed's own sub-brand (Nike Training Club for Nike) is set aside with the same field, never a column
  const own = (n: string) => [a.name, b.name].some((s) => n.toLowerCase().startsWith(s.toLowerCase()) && !/[\p{L}\p{N}]/u.test(n[s.length] ?? ""));

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
    else if (own(e.name) || [...fields(e)].some((f) => seedFields.has(f))) out.sameField.push(row);
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
// type: brands for the columns; the X-ray runs the same test in other domains (cache only, see runVs)
// peek: both reads at once, since a cache read spends nothing (AUDIT-F2: about 20 Redis round trips in a row held /vs
// on its skeleton 0.5 to 1.2 s on prod). Live: in turn, so a miss on the first never spends the second.
async function two<A, B>(peek: boolean, f: () => Promise<A>, g: () => Promise<B>): Promise<[A, B | null]> {
  if (peek) return Promise.all([f(), g()]);
  const x = await f();
  return [x, x ? await g() : null];
}

export async function getRivals(a: Entity, b: Entity, peek = false, type = BRAND): Promise<Rivals | null> {
  const get = (p: Record<string, string | number>) => (peek ? insights.peek(p) : insights(p));
  const [listA, listB] = await two(peek, () => get({ "filter.type": type, "signal.interests.entities": a.entity_id, take: 50 }), () => get({ "filter.type": type, "signal.interests.entities": b.entity_id, take: 50 })); // = fansTop50's key
  if (!listA || !listB) return null;
  const union = [...new Map([...listA, ...listB].map((e) => [e.entity_id, e])).keys()].filter((id) => id !== a.entity_id && id !== b.entity_id);
  const chunks = Array.from({ length: Math.ceil(union.length / BATCH) }, (_, i) => union.slice(i * BATCH, (i + 1) * BATCH));
  const batch = (seed: string, chunk: string[]) => get({ "filter.type": type, "signal.interests.entities": seed, "filter.results.entities": chunk.join(","), take: chunk.length });
  const score = async (seed: string) => {
    if (peek) {
      const all = await Promise.all(chunks.map((c) => batch(seed, c)));
      return all.some((h) => !h) ? null : all.flat() as Scored[];
    }
    const out: Scored[] = [];
    for (const chunk of chunks) {
      const hits = await batch(seed, chunk);
      if (!hits) return null;
      out.push(...hits);
    }
    return out;
  };
  const [sa, sb] = await two(peek, () => score(a.entity_id), () => score(b.entity_id));
  return sa && sb ? compareLists(a, b, listA, listB, sa, sb) : null;
}

// --- the page's loader (brief-oct13-vs): cards, rivals, compare tags; warm from cache or one counted cold run ---
// map null: a person seed (flat heatmaps, VERIFY-4 Cedric), so no heatmap calls and the page says so
export type VsMap = Collision & { metrosA: City[]; metrosB: City[] };
// X-ray (Perplexity moonshot 2, real Oct 13, scripts/xray-probe.ts): the rivals test in four more domains. Counts and
// the three widest gaps per side only. Cache only, never a call: a pair shows it once warmed (prepared pairs are).
export const XRAY_TYPES = ["artist", "tv_show", "movie", "podcast"].map((t) => `urn:entity:${t}`);
type XrayName = { name: string; a: number; b: number };
export type Xray = { type: string; leansA: number; leansB: number; shared: number; topA: XrayName[]; topB: XrayName[] };
const xrayOf = (type: string, r: Rivals): Xray => {
  const top = (rows: RivalRow[]) => rows.slice(0, 3).map((x) => ({ name: x.name, a: x.a!, b: x.b! }));
  return { type, leansA: r.leansA.length, leansB: r.leansB.length, shared: r.shared.length, topA: top(r.leansA), topB: top(r.leansB) };
};
export type VsData = { a: Entity; b: Entity; rivals: Rivals; share: string[]; map: VsMap | null; xray: Xray[] };
// what the page needs, without the seeds' full entities (sent to the browser by /api/rivals and the front door)
export type VsPayload = Omit<VsData, "a" | "b">;
export const toPayload = ({ rivals, share, map, xray }: VsData): VsPayload => ({ rivals, share, map, xray });
export type Side = { id: string; type: string };
export class ColdPairCap extends Error {}
const COLD_PAIRS_PER_IP = 10; // per UTC day; a cold pair is 8 to 11 Qloo calls (VERIFY-4, plus the compare chip)

export async function spendColdPair(ip: string) {
  const n = await incr(`cx:count:vs:${ip}:${today()}`, 60 * 60 * 48);
  if ((n ?? 0) > (ip === "warm" ? 200 : COLD_PAIRS_PER_IP)) throw new ColdPairCap();
}

// null: Qloo doesn't know one of the ids. Cold pieces cost the visitor one of their cold pairs, once, before any call.
export async function loadVs(sa: Side, sb: Side, ip: string): Promise<VsData | null> {
  const warm = await runVs(sa, sb, true);
  if (warm !== "cold") return warm;
  await spendColdPair(ip);
  const live = await runVs(sa, sb, false);
  return live === "cold" ? null : live;
}

// cache only, never a call (front door first paint, OG cards): "cold" when any piece isn't cached
export const peekVs = (sa: Side, sb: Side) => runVs(sa, sb, true);

async function runVs(sa0: Side, sb0: Side, peek: boolean): Promise<VsData | null | "cold"> {
  // Qloo ids are uppercase and the cache keys on the exact string: a lowercased link would re-spend (Oct 14 pass)
  const [sa, sb] = [sa0, sb0].map((s) => ({ ...s, id: s.id.toUpperCase() }));
  const card = async (s: Side) => {
    const p = { "filter.type": s.type, "filter.results.entities": s.id, take: 1 }; // = getCard's key
    const hits = peek ? await insights.peek(p) : await insights(p);
    return hits === null ? "cold" : (hits[0] ?? null);
  };
  const [a0, b0] = await two(peek, () => card(sa), () => card(sb));
  if (a0 === null || b0 === null) return null;
  if (a0 === "cold" || b0 === "cold") return "cold";
  // some cards come back with only the bare "urn:entity" (Cedric the Entertainer as a person): keep the asked type, so
  // the person check and the pairing links see it (Oct 14 pass)
  const typed = (e: Entity, t: string) => (e.types.some((x) => x !== "urn:entity") ? e : { ...e, types: [t] });
  const [a, b] = [typed(a0, sa.type), typed(b0, sb.type)];
  const people = [a, b].some((e) => e.types.includes("urn:entity:person"));
  const heat = (id: string) => (peek ? heatmap.peek(id, "United States") : heatmap(id, "United States")); // = getCities' key
  // the X-ray is cache only either way, so its four reads always go at once; on a peek everything else joins them
  const xrays = Promise.all(XRAY_TYPES.map((t) => getRivals(a, b, true, t)));
  const pre = peek ? Promise.all([getRivals(a, b, true), compareTags.peek(a.entity_id, b.entity_id), people ? null : two(true, () => heat(a.entity_id), () => heat(b.entity_id))]) : null;
  pre?.catch(() => {}); // awaited below; this only keeps an early return from leaving it unhandled
  xrays.catch(() => {});
  const rivals = pre ? (await pre)[0] : await getRivals(a, b, false);
  if (!rivals) return "cold";
  // the compare chip is garnish: a failed call leaves it off instead of failing the page
  const share = pre ? (await pre)[1] : await compareTags(a.entity_id, b.entity_id).catch(() => []);
  let map: VsMap | null = null;
  if (!people) {
    const [ha, hb] = pre ? (await pre)[2]! : await two(false, () => heat(a.entity_id), () => heat(b.entity_id));
    if (!ha || !hb) return "cold";
    map = { ...collide(ha, hb), metrosA: rankMetros(ha).slice(0, 5), metrosB: rankMetros(hb).slice(0, 5) };
  }
  const xray: Xray[] = [];
  (await xrays).forEach((x, i) => x && xray.push(xrayOf(XRAY_TYPES[i], x)));
  // a pair warmed before the chip existed stays warm: a cold chip never makes the page cold
  return { a, b, rivals, share: (share ?? []).slice(0, 4), map, xray };
}
