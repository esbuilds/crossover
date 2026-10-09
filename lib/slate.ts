// Partner slate: what the entity's fans over-index on, across six Qloo domains (PLAN.md section 3).
import { insights, insightsPost, type Entity, type Signal } from "./qloo.ts";

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
  tags: e.tags.slice(0, 5).map((t) => t.name),
  explainability: e.explainability,
});

// seed: one resolved entity id, or weighted proxies when Qloo doesn't know the brand.
// All six calls start at once; the client's 4/s bucket spaces them out.
export async function getSlate(seed: string | Signal[]): Promise<Slate> {
  const lists = await Promise.all(
    DOMAINS.map((d) => {
      const params = { take: 10, "feature.explainability": "true" };
      const type = `urn:entity:${d}`;
      return typeof seed === "string"
        ? insights({ "filter.type": type, "signal.interests.entities": seed, "filter.exclude.entities": seed, ...params })
        : insightsPost(type, seed, params);
    }),
  );
  return Object.fromEntries(DOMAINS.map((d, i) => [d, lists[i].map(toPick)])) as Slate;
}
