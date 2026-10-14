// Upstash Redis over its REST API (KV_REST_API_URL / KV_REST_API_TOKEN, set by the Vercel integration).
// ponytail: plain fetch instead of @upstash/redis; we use four commands. Every call fails soft: if Redis is down
// or unset (tests, scripts), callers fall back to computing the value, never to an error page.
const url = () => process.env.KV_REST_API_URL;
const token = () => process.env.KV_REST_API_TOKEN;
export const redisEnabled = () => !!(url() && token());
// A stalled connection ends as a miss (Oct 13 adversarial pass: an ask hung for minutes on one Redis read).
export const REDIS_TIMEOUT_MS = 4000;

async function pipeline(commands: (string | number)[][]): Promise<unknown[] | null> {
  if (!redisEnabled()) return null;
  try {
    const res = await fetch(`${url()}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Redis ${res.status}`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    return out.map((r) => (r.error ? null : r.result));
  } catch (err) {
    console.error("[redis]", err);
    return null;
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const [v] = (await pipeline([["GET", key]])) ?? [null];
  return typeof v === "string" ? (JSON.parse(v) as T) : null;
}

export async function setJson(key: string, value: unknown, ttlSeconds: number) {
  await pipeline([["SET", key, JSON.stringify(value), "EX", ttlSeconds]]);
}

// Increment a counter that expires on its own (daily counters). Returns null when Redis is unavailable.
export async function incr(key: string, ttlSeconds: number): Promise<number | null> {
  const out = await pipeline([
    ["INCR", key],
    ["EXPIRE", key, ttlSeconds],
  ]);
  return typeof out?.[0] === "number" ? out[0] : null;
}

export async function decr(key: string) {
  await pipeline([["DECR", key]]);
}

export async function getNumber(key: string): Promise<number | null> {
  const [v] = (await pipeline([["GET", key]])) ?? [null];
  return v == null ? null : Number(v);
}

export async function setNumber(key: string, n: number, ttlSeconds: number) {
  await pipeline([["SET", key, n, "EX", ttlSeconds]]);
}

export const today = () => new Date().toISOString().slice(0, 10);
