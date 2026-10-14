// "Where to start" (Eric's features push, real Oct 14): venues in one market that both the seed's and the first call's
// fans favor, with the brief's own venue params (restaurants and bars, plus live music for artists; both entities as
// signals). Computed by code beside the frozen answer, never part of it. Qloo's scores tie within a city on the probe
// (0.92 for all six in San Francisco), so the line lists names and never a number. Probe: scripts/venues-probe.ts.
import { insights, placeTag, type Entity } from "../qloo.ts";

type Get = (p: Record<string, string | number>) => Promise<Entity[]>;
const PLACE_TAGS = ["urn:tag:category:place:restaurant", "urn:tag:category:place:bar"];

export async function venuesIn(o: { seedId: string; pickId: string; market: string; artist: boolean }, get: Get = (p) => insights(p)) {
  const music = o.artist ? await placeTag("live music venue").catch(() => null) : null;
  const tags = [...(music ? [music.tag_id] : []), ...PLACE_TAGS];
  const lists: Entity[][] = [];
  for (const tag of tags) lists.push(await get({ "filter.type": "urn:entity:place", "filter.location.query": o.market, "filter.tags": tag, take: 8, "signal.interests.entities": `${o.seedId},${o.pickId}` }).catch(() => []));
  return lists.flat().filter((v, i, all) => all.findIndex((x) => x.entity_id === v.entity_id) === i).slice(0, 4).map((v) => ({ name: v.name, city: v.city ?? null }));
}

export function venueLine(market: string, seed: string, pick: string, venues: { name: string }[]): string | null {
  if (venues.length < 3) return null;
  const names = venues.slice(0, 3).map((v) => v.name);
  return `Venues in ${market} that ${seed} and ${pick} fans both favor: ${names.slice(0, -1).join(", ")} and ${names.at(-1)}.`;
}
