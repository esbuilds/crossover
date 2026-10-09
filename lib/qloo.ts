// Server-side Qloo client. Every Qloo call in the app goes through this file.
import { unstable_cache } from "next/cache.js"; // .js so plain node scripts resolve it too

// ponytail: env guard instead of the server-only package; the key is not NEXT_PUBLIC so it never reaches a bundle anyway
if (typeof window !== "undefined") throw new Error("lib/qloo is server-only");

const BASE = "https://hackathon.api.qloo.com";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export type Tag = { tag_id: string; name: string; type: string };
export type Entity = {
  entity_id: string;
  name: string;
  types: string[];
  popularity: number;
  short_description?: string;
  image?: string;
  akas: string[];
  tags: Tag[];
  affinity?: number;
  explainability?: unknown;
  // places only
  address?: string;
  city?: string;
  price_level?: number;
  lat?: number;
  lon?: number;
};
export type HeatCell = { lat: number; lon: number; affinity: number; affinity_rank: number; popularity: number };

// --- rate limit: the key allows 5/s and 10,000/month; stay at 4/s ---
// ponytail: bucket of size 1 (one slot every 250ms), per process. Bursting is never worth a 429.
let nextSlot = 0;
let calls = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function slot() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 250;
  if (at > now) await sleep(at - now);
}

async function request(path: string, init: { query?: Record<string, string | number>; body?: unknown } = {}) {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new Error("QLOO_API_KEY is not set");
  const qs = init.query ? "?" + new URLSearchParams(Object.entries(init.query).map(([k, v]) => [k, String(v)])) : "";
  const opts: RequestInit = {
    method: init.body ? "POST" : "GET",
    headers: { "X-Api-Key": key, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store", // unstable_cache owns caching; don't double-store raw responses
  };

  for (let attempt = 0; ; attempt++) {
    await slot();
    calls++;
    console.log(`[qloo] call #${calls} ${opts.method} ${path}`);
    const res = await fetch(BASE + path + qs, opts);
    if (res.status === 429 && attempt === 0) {
      const reset = Number(res.headers.get("X-Second-RateLimit-Reset")) || 1;
      await sleep(Math.min(reset, 5) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`Qloo ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
}

export const qlooCallCount = () => calls;

// --- trimming: keep only what the app uses (PLAN.md section 3), so cache entries stay small ---
type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function trimEntity(e: Raw): Entity {
  const p = e.properties ?? {};
  const akas: string[] = [...new Set<string>((p.akas ?? []).map((a: Raw) => a.value).filter(Boolean))];
  return {
    entity_id: e.entity_id,
    name: e.name,
    types: e.types ?? (e.type ? [e.type] : []),
    popularity: e.popularity ?? 0,
    short_description: p.short_description,
    image: p.image?.url,
    akas,
    tags: (e.tags ?? []).slice(0, 12).map((t: Raw) => ({ tag_id: t.tag_id ?? t.id, name: t.name, type: t.type })),
    affinity: e.query?.affinity,
    explainability: e.query?.explainability,
    address: p.address,
    city: p.geocode?.city,
    price_level: p.price_level,
    lat: e.location?.lat,
    lon: e.location?.lon,
  };
}

const trimEntities = (body: Raw): Entity[] => {
  const r = body.results;
  return (Array.isArray(r) ? r : (r?.entities ?? [])).map(trimEntity);
};

function cached<A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) {
  const c = unstable_cache(fn, ["qloo", name], { revalidate: THIRTY_DAYS });
  // plain node scripts (fixture recording) have no Next cache; call straight through
  return (...args: A) => (process.env.NEXT_RUNTIME ? c(...args) : fn(...args));
}

// --- public API ---

// what the resolve step searches across. PLAN.md section 3 listed place too; dropped Oct 9 because
// exact-name local shops crowd out brands (a "Pistakio" gelato shop, a "Fruition Chocolate Works" storefront)
export const RESOLVE_TYPES = ["brand", "artist", "tv_show", "movie", "person"].map((t) => `urn:entity:${t}`);

export const search = cached("search", async (query: string, types: string[], take: number = 5) =>
  trimEntities(await request("/search", { query: { query, types: types.join(","), take } })),
);

export const insights = cached("insights", async (params: Record<string, string | number>) =>
  trimEntities(await request("/v2/insights", { query: params })),
);

export const insightsPost = cached("insightsPost", async (body: Record<string, unknown>) =>
  trimEntities(await request("/v2/insights", { body })),
);

export const heatmap = cached("heatmap", async (entityId: string, locationQuery: string): Promise<HeatCell[]> => {
  const body = await request("/v2/insights", {
    query: { "filter.type": "urn:heatmap", "signal.interests.entities": entityId, "filter.location.query": locationQuery },
  });
  return (body.results?.heatmap ?? []).map((c: Raw) => ({
    lat: c.location.latitude,
    lon: c.location.longitude,
    affinity: c.query.affinity,
    affinity_rank: c.query.affinity_rank,
    popularity: c.query.popularity,
  }));
});

export const tags = cached("tags", async (query: string): Promise<Tag[]> => {
  const body = await request("/v2/tags", { query: { "filter.query": query } });
  const r = body.results;
  return (Array.isArray(r) ? r : (r?.tags ?? [])).map((t: Raw) => ({ tag_id: t.id ?? t.tag_id, name: t.name, type: t.type }));
});
