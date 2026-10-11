// Who's your rival, rival-v2 (brief-oct12-rival2): one name in, the closest brand from the seed's own top 50, chosen in
// code. Field order: the seed's second-level genre tag (the /vs same-field rule); if it has none, a Qloo
// product_category tag; if still nothing, the broader chips. Qloo's competitor_brand tags ride along as a second chip
// line, cited as Qloo's label and resolved only when clicked. Non-brand seeds get their top three brands as chips.
import { fullTags, insights, type Entity, type FullTags } from "./qloo.ts";

export const RIVAL_VERSION = "rival-v2";
export type Found = { id: string; name: string; type: string; affinity: number | null };
export type RivalPick =
  | { kind: "pick"; field: "genre" | "category"; category?: string; pick: Found; alternates: Found[]; competitors: string[] }
  | { kind: "broader"; options: Found[]; competitors: string[] } // nothing in its field: top three sharing the top-level genre
  | { kind: "brands"; options: Found[] } // an artist, person or show: no brand field to match
  | { kind: "none"; competitors: string[] };

const BRAND = "urn:entity:brand";
const found = (e: Entity): Found => ({ id: e.entity_id, name: e.name, type: BRAND, affinity: e.affinity ?? null });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const genreAt = (ids: string[], level: 5 | 6) => new Set(ids.filter((t) => t.split(":").length >= level).map((t) => t.split(":").slice(0, level).join(":")));

// list: the seed's top 50 brands. full: untrimmed tags by id (seed and list); trimmed tags stand in when missing.
export function pickRival(seed: Entity, seedType: string, list: Entity[], full: Map<string, FullTags>): RivalPick {
  const own = norm(seed.name);
  const pool = list.filter((e) => e.entity_id !== seed.entity_id && !norm(e.name).includes(own)).sort((x, y) => (y.affinity ?? 0) - (x.affinity ?? 0));
  if (seedType !== BRAND) return { kind: "brands", options: pool.slice(0, 3).map(found) };
  const tagsOf = (e: Entity) => full.get(e.entity_id) ?? { id: e.entity_id, genres: e.tags.map((t) => t.tag_id).filter((t) => t.startsWith("urn:tag:genre:brand:")), categories: [], competitors: [] };
  const me = tagsOf(seed);
  const competitors = me.competitors.filter((n) => norm(n) !== own);
  const sharing = (level: 5 | 6) => {
    const mine = genreAt(me.genres, level);
    return pool.filter((e) => [...genreAt(tagsOf(e).genres, level)].some((g) => mine.has(g)));
  };
  const close = sharing(6);
  if (close.length) return { kind: "pick", field: "genre", pick: found(close[0]), alternates: close.slice(1, 3).map(found), competitors };
  // the most specific shared category first: the seed's category that the fewest list brands carry (soft drinks before
  // beverages), so the line names a category a brand person would use
  const byCategory = me.categories
    .map((c) => ({ c, hits: pool.filter((e) => tagsOf(e).categories.some((x) => x.id === c.id)) }))
    .filter((x) => x.hits.length)
    .sort((x, y) => x.hits.length - y.hits.length);
  if (byCategory.length) {
    const { c, hits } = byCategory[0];
    return { kind: "pick", field: "category", category: c.name.toLowerCase(), pick: found(hits[0]), alternates: hits.slice(1, 3).map(found), competitors };
  }
  const broader = sharing(5);
  return broader.length ? { kind: "broader", options: broader.slice(0, 3).map(found), competitors } : { kind: "none", competitors };
}

// The seed's card and its top 50 brands (the pair's own keys), plus their untrimmed tags for brand seeds: 4 Qloo calls
// cold, 0 warm. peek: cache only; "cold" when anything is missing. null: Qloo doesn't know the id.
export async function findRival(id0: string, type: string, peek: boolean): Promise<{ seed: Entity; result: RivalPick } | null | "cold"> {
  const id = id0.toUpperCase(); // the cache keys on Qloo's uppercase ids
  const get = (p: Record<string, string | number>) => (peek ? insights.peek(p) : insights(p));
  const card = { "filter.type": type, "filter.results.entities": id, take: 1 };
  const top = { "filter.type": BRAND, "signal.interests.entities": id, take: 50 };
  const cards = await get(card);
  if (cards === null) return "cold";
  if (!cards[0]) return null;
  const list = await get(top);
  if (list === null) return "cold";
  const full = new Map<string, FullTags>();
  if (type === BRAND) {
    const tags = (p: Record<string, string | number>) => (peek ? fullTags.peek(p) : fullTags(p));
    const [fc, fl] = [await tags(card), await tags(top)];
    if (fc === null || fl === null) return "cold";
    for (const t of [...fc, ...fl]) full.set(t.id, t);
  }
  return { seed: cards[0], result: pickRival(cards[0], type, list, full) };
}
