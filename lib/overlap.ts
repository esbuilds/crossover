// Where both audiences run hot: markets in both entities' top tens, by combined over-index.
// Used by the brief agent to pick a launch market (the design notes, geographic overlap).
import type { City } from "./cities.ts";

export type Overlap = { market: string; seed_over_index: number; partner_over_index: number; combined: number };

export function overlapMarkets(seed: City[], partner: City[], top = 10): Overlap[] {
  const theirs = new Map(partner.slice(0, top).map((m) => [m.name, m.overIndex]));
  return seed
    .slice(0, top)
    .filter((m) => theirs.has(m.name))
    .map((m) => ({ market: m.name, seed_over_index: m.overIndex, partner_over_index: theirs.get(m.name)!, combined: m.overIndex + theirs.get(m.name)! }))
    .sort((a, b) => b.combined - a.combined);
}
