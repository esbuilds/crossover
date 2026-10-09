// Partner slate: what the entity's fans over-index on, across six Qloo domains (PLAN.md section 3).
import { insights, insightsPost, RESOLVE_TYPES, type Entity, type Signal } from "./qloo.ts";
import { TAG_WEIGHT } from "./proxy-params.ts";

export const DOMAINS = ["brand", "artist", "tv_show", "movie", "place", "podcast"] as const;
export type Domain = (typeof DOMAINS)[number];

export type Pick = {
  entity_id: string;
  name: string;
  type: string;
  affinity: number;
  popularity: number;
  image?: string;
  short_description?: string;
  tags: string[];
  explainability?: number;
  driven_by?: string;
};
export type Slate = Record<Domain, Pick[]>;

const toPick = (e: Entity): Pick => ({
  entity_id: e.entity_id,
  name: e.name,
  type: e.types[0],
  affinity: e.affinity ?? 0,
  popularity: e.popularity,
  image: e.image,
  short_description: e.short_description,
  tags: [...new Set(e.tags.map((t) => t.name))].slice(0, 5), // the same name can appear under two tag types
  explainability: e.explainability,
  driven_by: e.driven_by,
});

// seed: one resolved entity id, or weighted proxies when Qloo doesn't know the brand.
// All six calls start at once; the client's 4/s bucket spaces them out. onDomain fires as each one lands.
// tag (proxy mode only): a brand-category tag applied to the brand call, so a tinned-fish brand's stand-ins
// (cookware) don't turn its brand row into home goods. Brand domain only: it's a brand tag.
export async function getSlate(seed: string | Signal[], onDomain?: (d: Domain, picks: Pick[]) => void, tag?: string | null): Promise<Slate> {
  const lists = await Promise.all(
    DOMAINS.map(async (d) => {
      const params = { take: 10, "feature.explainability": "true" };
      const type = `urn:entity:${d}`;
      const tagged = tag && d === "brand" ? { "signal.interests.tags": [{ tag, weight: TAG_WEIGHT }] } : {};
      const raw =
        typeof seed === "string"
          ? await insights({ "filter.type": type, "signal.interests.entities": seed, "filter.exclude.entities": seed, ...params })
          : await insightsPost(type, seed, { ...params, ...tagged });
      const picks = raw.map(toPick);
      onDomain?.(d, picks);
      return picks;
    }),
  );
  return Object.fromEntries(DOMAINS.map((d, i) => [d, lists[i]])) as Slate;
}

// Brands first, then strongest evidence: domains by the mean affinity of their top three picks, places always last
// (PLAN.md section 8: place picks skew to hotels and ski resorts until the agent filters them).
export function orderSlate(slate: Slate): { domain: Domain; picks: Pick[] }[] {
  const strength = (picks: Pick[]) => picks.slice(0, 3).reduce((s, p) => s + p.affinity, 0) / 3;
  return DOMAINS.map((domain) => ({ domain, picks: slate[domain] }))
    .filter((d) => d.picks.length)
    .sort(
      (a, b) =>
        Number(b.domain === "brand") - Number(a.domain === "brand") || // brands first: partners are the pitch (PLAN.md section 8, Oct 11)
        Number(a.domain === "place") - Number(b.domain === "place") ||
        strength(b.picks) - strength(a.picks),
    );
}

// What a match card shows. Shared by /api/resolve candidates and the /api/slate header.
export type Card = { entity_id: string; name: string; type: string; popularity: number; image?: string; short_description?: string };

export const toCard = (e: Entity, type = e.types[0]): Card => ({
  entity_id: e.entity_id,
  name: e.name,
  type,
  popularity: e.popularity,
  image: e.image,
  short_description: e.short_description,
});

// A shared /s/<id> link has only the id and the hackathon host has no /v2/entities. A filter-only insights call
// returns the entity when the type matches; try types in order. 1 call when the caller passes the type it already
// knows from resolve, otherwise up to 5 (brands first). Cached 30 days.
export async function getCard(id: string, typeHint?: string | null): Promise<Card | null> {
  const types = RESOLVE_TYPES.includes(typeHint ?? "") ? [typeHint!, ...RESOLVE_TYPES.filter((t) => t !== typeHint)] : RESOLVE_TYPES;
  for (const type of types) {
    const [hit] = await insights({ "filter.type": type, "filter.results.entities": id, take: 1 });
    if (hit) return toCard(hit, type);
  }
  return null;
}
