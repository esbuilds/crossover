// Who's your rival (brief-oct13-rival): one name in, the closest same-field brand by affinity from the seed's own top
// 50 brands, chosen in code. Same-field = the seed's second-level genre tag, the rule the /vs same-field fold uses.
import { insights, type Entity } from "./qloo.ts";
import { fieldsAt } from "./rivals.ts";

export type Found = { id: string; name: string; type: string; affinity: number | null };
export type RivalPick =
  | { kind: "pick"; pick: Found; alternates: Found[] }
  | { kind: "broader"; options: Found[] } // nothing shares the second-level tag: top three sharing the top level
  | { kind: "none" };

const BRAND = "urn:entity:brand";
const found = (e: Entity): Found => ({ id: e.entity_id, name: e.name, type: BRAND, affinity: e.affinity ?? null });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// list: the seed's top 50 brands in Qloo's order (affinity descending). Sub-brands (name contains the seed's name,
// "Liquid Death Mountain Water") and the seed itself are never picked.
export function pickRival(seed: Entity, list: Entity[]): RivalPick {
  const own = norm(seed.name);
  const pool = list.filter((e) => e.entity_id !== seed.entity_id && !norm(e.name).includes(own)).sort((x, y) => (y.affinity ?? 0) - (x.affinity ?? 0));
  const share = (level: 5 | 6) => {
    const mine = fieldsAt(seed, level);
    return pool.filter((e) => [...fieldsAt(e, level)].some((f) => mine.has(f)));
  };
  const close = share(6);
  if (close.length) return { kind: "pick", pick: found(close[0]), alternates: close.slice(1, 3).map(found) };
  const broader = share(5);
  return broader.length ? { kind: "broader", options: broader.slice(0, 3).map(found) } : { kind: "none" };
}

// The seed's card and its top 50 brands: 2 Qloo calls cold, the same keys as the pair's (so the pair reuses them).
// peek: cache only; "cold" when either is missing. null: Qloo doesn't know the id.
export async function findRival(id: string, type: string, peek: boolean): Promise<{ seed: Entity; result: RivalPick } | null | "cold"> {
  const get = (p: Record<string, string | number>) => (peek ? insights.peek(p) : insights(p));
  const cards = await get({ "filter.type": type, "filter.results.entities": id, take: 1 });
  if (cards === null) return "cold";
  if (!cards[0]) return null;
  const list = await get({ "filter.type": BRAND, "signal.interests.entities": id, take: 50 });
  if (list === null) return "cold";
  return { seed: cards[0], result: pickRival(cards[0], list) };
}
