// The recorded /search fixture keeps no Qloo numbers (planner ruling, real Oct 12): popularity is entity-level Qloo
// output, so the recorder stores the two facts the resolver's rules read, derived by our code, and the test loader
// maps them back to stand-in values that reproduce the same comparisons. Production reads live popularity.
import { POPULARITY_FLOOR, tokens } from "./resolve.ts";

export type Recorded = { name: string; entity_id: string; types: string[]; belowFloor: boolean; winsPersonArtistTie: boolean };
type Hit = { name: string; entity_id: string; types: string[]; popularity: number };

// belowFloor: the 0.3 floor. winsPersonArtistTie: among exact-name hits above the floor, the person or artist the
// resolver's tiebreak picks (the more popular one, the artist within 0.1).
export function derive(query: string, hits: Hit[]): Recorded[] {
  const q = tokens(query).join(" ");
  const known = hits.filter((h) => tokens(h.name).join(" ") === q && h.popularity >= POPULARITY_FLOOR);
  const person = known.find((h) => h.types.includes("urn:entity:person"));
  const artist = known.find((h) => h.types.includes("urn:entity:artist"));
  const winner = person && artist ? (person.popularity > artist.popularity + 0.1 ? person : artist) : null;
  return hits.map((h) => ({ name: h.name, entity_id: h.entity_id, types: h.types, belowFloor: h.popularity < POPULARITY_FLOOR, winsPersonArtistTie: h === winner }));
}

// Test side: below the floor 0, the tie winner 0.9, everyone else 0.5 (above the floor, and 0.9 > 0.5 + 0.1 so the
// recorded winner wins either way round).
export const standInPopularity = (r: Recorded) => (r.belowFloor ? 0 : r.winsPersonArtistTie ? 0.9 : 0.5);
