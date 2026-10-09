// Partner slate: what the entity's fans over-index on, across six Qloo domains (PLAN.md section 3).
import { insights, insightsPost, QuotaError, RESOLVE_TYPES, type Entity, type Signal } from "./qloo.ts";
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
// refine (Oct 19): per-domain extra params from a constraint set (lib/refine.ts refineParams); null skips the
// domain. Without refine the params are exactly what they always were, so unrefined runs keep their cache hits.
// relaxedFor: the same params with hard include-tag filters turned into soft signals, used when a domain comes
// back empty under the filter. onNote reports what happened to a domain in plain words (trace).
export type RefineHook = {
  paramsFor: (d: Domain) => Record<string, string | number> | null;
  relaxedFor?: (d: Domain) => Record<string, string | number> | null;
  excludeIds: string[];
  onNote?: (text: string) => void;
};
const DOMAIN_LABEL: Record<Domain, string> = { brand: "brands", artist: "artists", tv_show: "TV shows", movie: "films", place: "places", podcast: "podcasts" };

export async function getSlate(seed: string | Signal[], onDomain?: (d: Domain, picks: Pick[]) => void, tag?: string | null, refine?: RefineHook | null): Promise<Slate> {
  const lists = await Promise.all(
    DOMAINS.map(async (d) => {
      const extra = refine ? refine.paramsFor(d) : {};
      if (extra === null) {
        onDomain?.(d, []);
        return [];
      }
      const params = { take: 10, "feature.explainability": "true", ...extra };
      const type = `urn:entity:${d}`;
      const tagged = tag && d === "brand" ? { "signal.interests.tags": [{ tag, weight: TAG_WEIGHT }] } : {};
      const exclude = [typeof seed === "string" ? seed : null, ...(refine?.excludeIds ?? [])].filter(Boolean).join(",");
      const call = (p: Record<string, string | number>) =>
        typeof seed === "string"
          ? insights({ "filter.type": type, "signal.interests.entities": seed, "filter.exclude.entities": exclude, ...p })
          : insightsPost(type, seed, { ...p, ...tagged, ...(refine?.excludeIds.length ? { "filter.exclude.entities": refine.excludeIds.join(",") } : {}) });
      let raw: Entity[];
      if (!refine) raw = await call(params);
      else {
        // refined runs: one domain failing (a Qloo timeout) or coming back empty under a hard filter shouldn't sink
        // the whole slate. Quota errors still propagate.
        try {
          raw = await call(params);
          const relaxed = raw.length ? null : refine.relaxedFor?.(d);
          if (relaxed) {
            raw = await call({ take: 10, "feature.explainability": "true", ...relaxed });
            refine.onNote?.(`No ${DOMAIN_LABEL[d]} carry that tag in Qloo, so ${DOMAIN_LABEL[d]} lean toward it instead of requiring it`);
          }
        } catch (err) {
          if (err instanceof QuotaError) throw err;
          console.error(`[slate] ${d} failed`, err);
          refine.onNote?.(`Qloo didn't answer for ${DOMAIN_LABEL[d]} with these filters; skipped them`);
          raw = [];
        }
      }
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

// The hackathon host has no /v2/entities, so a card comes from a filter-only insights call for one type: 1 call,
// cached 30 days. An empty result is cached too, so a repeat of an unknown id is free (that is the not-found
// cache). Public routes and share links must pass the type (Oct 19): an untyped lookup tries all five types, and
// a stream of random ids could burn the daily cap. Only internal callers without a type fall back to the loop.
export const isEntityType = (t: string | null | undefined): t is string => RESOLVE_TYPES.includes(t ?? "");
export async function getCard(id: string, typeHint?: string | null): Promise<Card | null> {
  const types = isEntityType(typeHint) ? [typeHint] : RESOLVE_TYPES;
  for (const type of types) {
    const [hit] = await insights({ "filter.type": type, "filter.results.entities": id, take: 1 });
    if (hit) return toCard(hit, type);
  }
  return null;
}
