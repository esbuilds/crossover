// Server-side Qloo client. Every Qloo call in the app goes through this file.
import { createHash } from "node:crypto";
import { forced } from "./force.ts";
import { getJson, setJson, incr, decr, getNumber, setNumber, today } from "./redis.ts";

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
  explainability?: number; // how much the seed drove this pick (0-1); max across seeds
  driven_by?: string; // entity_id of the seed that drove it most; only meaningful with several (proxy) seeds
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
let monthRemaining: number | null = null;
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
    cache: "no-store", // cached() owns caching; don't double-store raw responses
  };

  if (forced("qloo429")) throw new QuotaError("forced 429");
  await spendDaily();
  for (let attempt = 0; ; attempt++) {
    await slot();
    calls++;
    console.log(`[qloo] call #${calls} ${opts.method} ${path}`);
    const res = await fetch(BASE + path + qs, opts);
    const left = res.headers.get("X-Month-RateLimit-Remaining");
    if (left !== null) {
      monthRemaining = Number(left);
      void setNumber("cx:qloo:monthRemaining", monthRemaining, THIRTY_DAYS); // shared, for /api/usage
    }
    if (res.status === 429 && attempt === 0) {
      const reset = Number(res.headers.get("X-Second-RateLimit-Reset")) || 1;
      await sleep(Math.min(reset, 5) * 1000);
      continue;
    }
    // Qloo's gateway sometimes times out on heavily filtered calls (a 504 on Oct 19); one retry, then give up
    if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt === 0) {
      await sleep(1000);
      continue;
    }
    if (!res.ok && (res.status === 429 || monthRemaining === 0)) throw new QuotaError(`Qloo ${res.status} ${path}`);
    if (!res.ok) throw new Error(`Qloo ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
}

export const qlooCallCount = () => calls;

// Rate limit hit twice in a row, or the month's quota is gone. Routes turn this into a friendly message;
// anything already in the 30-day cache still loads.
export class QuotaError extends Error {}

// Hard daily ceiling on live Qloo calls (QLOO_DAILY_CAP, unset = no cap). Cached responses never count.
// Counted in Redis per day, so it holds across every instance; falls back to a per-instance count without Redis.
let localDay = "";
let localCalls = 0;
async function spendDaily() {
  const cap = Number(process.env.QLOO_DAILY_CAP) || 0;
  const key = `cx:count:qloo:${today()}`;
  const shared = await incr(key, 60 * 60 * 48);
  if (localDay !== today()) [localDay, localCalls] = [today(), 0];
  const n = shared ?? ++localCalls;
  if (cap && n > cap) {
    // over the cap: undo the increment so the counter only ever counts calls that were made
    if (shared !== null) await decr(key);
    else localCalls--;
    throw new QuotaError(`daily cap of ${cap} Qloo calls reached`);
  }
}

export async function qlooToday() {
  return { today: (await getNumber(`cx:count:qloo:${today()}`)) ?? localCalls, cap: Number(process.env.QLOO_DAILY_CAP) || null, monthRemaining: (await getNumber("cx:qloo:monthRemaining")) ?? monthRemaining };
}
// ponytail: per process. On Vercel each instance counts its own calls; the month header is the real total.
export const qlooUsage = () => ({ calls, monthRemaining });

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
    explainability: maxScore(e.query?.explainability?.["signal.interests.entities"]),
    driven_by: topSignal(e.query?.explainability?.["signal.interests.entities"]),
    address: p.address,
    city: p.geocode?.city,
    price_level: p.price_level,
    lat: e.location?.lat,
    lon: e.location?.lon,
  };
}

function maxScore(signals: Raw[] | undefined) {
  return signals?.length ? Math.max(...signals.map((s) => s.score ?? 0)) : undefined;
}
function topSignal(signals: Raw[] | undefined): string | undefined {
  return signals?.length ? signals.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a)).entity_id : undefined;
}

const trimEntities = (body: Raw): Entity[] => {
  const r = body.results;
  return (Array.isArray(r) ? r : (r?.entities ?? [])).map(trimEntity);
};

// 30-day cache in Redis, keyed by name and a hash of the arguments only (version labels are arguments), so a deploy
// never invalidates anything. unstable_cache was dropped Oct 16: its key includes the function's source, and every
// deploy rebuilt it, so each deploy started cold and re-spent Qloo calls.
// Also used by the agent (rankings, briefs, proposals) so repeat demos are identical and free.
export function cached<A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) {
  const run = async (...args: A): Promise<R> => {
    const key = `cx:${name}:${createHash("sha1").update(JSON.stringify(args)).digest("hex")}`;
    const hit = await getJson<R>(key);
    if (hit !== null) return hit;
    const result = await fn(...args);
    await setJson(key, result, THIRTY_DAYS);
    return result;
  };
  return process.env.NODE_ENV === "development" ? devFileCache(name, run) : run;
}

// Development only: a read-through file layer in front of Redis, so local work doesn't touch the shared cache's
// quota and survives offline. Results persist to .cache/<name>/<hash>.json (gitignored).
// ponytail: no expiry; delete .cache/ to start fresh.
function devFileCache<A extends unknown[], R>(name: string, run: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    const { createHash } = await import("node:crypto");
    const { readFile, writeFile, mkdir } = await import("node:fs/promises");
    const dir = `${process.cwd()}/.cache/${name}`;
    const file = `${dir}/${createHash("sha1").update(JSON.stringify(args)).digest("hex")}.json`;
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch {} // miss
    const result = await run(...args);
    await mkdir(dir, { recursive: true });
    await writeFile(file, JSON.stringify(result));
    return result;
  };
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

export type Signal = { id: string; weight: number };

// Proxy seeding: weighted entities via POST. The field is "id", not "entity" as the docs show.
// The proxies themselves are always excluded from results.
export const proxyBody = (type: string, signals: Signal[], params: Record<string, unknown> = {}) => ({
  "filter.type": type,
  "signal.interests.entities": signals,
  ...params,
  "filter.exclude.entities": [...signals.map((s) => s.id), params["filter.exclude.entities"]].filter(Boolean).join(","),
});

export const insightsPost = cached("insightsPost", async (type: string, signals: Signal[], params: Record<string, unknown> = {}) =>
  trimEntities(await request("/v2/insights", { body: proxyBody(type, signals, params) })),
);

export const heatmap = cached("heatmap", async (seed: string | Signal[], locationQuery: string): Promise<HeatCell[]> => {
  const params = { "filter.type": "urn:heatmap", "signal.interests.entities": seed, "filter.location.query": locationQuery };
  const body = typeof seed === "string" ? await request("/v2/insights", { query: params as Record<string, string> }) : await request("/v2/insights", { body: params });
  // rounded: up to 11k cells per entity and the cache entry limit is 2 MB
  const r = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
  return (body.results?.heatmap ?? []).map((c: Raw) => ({
    lat: r(c.location.latitude, 4),
    lon: r(c.location.longitude, 4),
    affinity: r(c.query.affinity, 3),
    affinity_rank: r(c.query.affinity_rank, 3),
    popularity: r(c.query.popularity, 3),
  }));
});

// Tag search restricted to parent entity types (csv of urn:entity:...), with parents kept so callers can choose.
// 1 call, cached. Used by refine to turn "no beer" into a tag id.
export const tagSearch = cached("tagSearch", async (query: string, parentTypes: string) => {
  const body = await request("/v2/tags", { query: { "filter.query": query, "filter.parents.types": parentTypes } });
  return (body.results?.tags ?? []).slice(0, 20).map((t: Raw) => ({ id: t.id as string, name: t.name as string, type: t.type as string, parents: (t.parents ?? []) as { type: string }[] }));
});

// A place-category tag for a phrase ("live music venue"), for venue lookups. 1 call, cached.
export const placeTag = cached("placeTag", async (query: string): Promise<Tag | null> => {
  const body = await request("/v2/tags", { query: { "filter.query": query, "filter.parents.types": "urn:entity:place" } });
  const t = (body.results?.tags ?? []).find((x: Raw) => String(x.id).startsWith("urn:tag:category:place:")) ?? (body.results?.tags ?? [])[0];
  return t ? { tag_id: t.id, name: t.name, type: t.type } : null;
});

// A brand-category tag for a product phrase ("seafood" -> Meat, Seafood, & Substitutes). Without the parents
// filter, /v2/tags returns place tags (restaurant menus), which do nothing for brand results. 1 call, cached.
export const brandTag = cached("brandTag", async (query: string): Promise<Tag | null> => {
  const body = await request("/v2/tags", { query: { "filter.query": query, "filter.parents.types": "urn:entity:brand" } });
  const t = (body.results?.tags ?? [])[0];
  return t ? { tag_id: t.id, name: t.name, type: t.type } : null;
});

export const tags = cached("tags", async (query: string): Promise<Tag[]> => {
  const body = await request("/v2/tags", { query: { "filter.query": query } });
  const r = body.results;
  return (Array.isArray(r) ? r : (r?.tags ?? [])).map((t: Raw) => ({ tag_id: t.id ?? t.tag_id, name: t.name, type: t.type }));
});
