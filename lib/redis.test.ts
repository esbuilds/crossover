// Found in the Oct 13 adversarial pass: a stalled Upstash connection hung an ask for minutes (no timeout on fetch).
// Redis fails soft, so a stall must end quickly as a miss.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getJson, REDIS_TIMEOUT_MS } from "./redis.ts";

test("a Redis request that never answers ends as a miss within the timeout", async () => {
  const saved = { fetch: globalThis.fetch, url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  process.env.KV_REST_API_URL = "https://redis.invalid";
  process.env.KV_REST_API_TOKEN = "t";
  // a server that never responds: settles only when the request's signal aborts
  globalThis.fetch = ((_u: unknown, init?: RequestInit) => new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)))) as typeof fetch;
  const t0 = Date.now();
  const alive = setInterval(() => {}, 500); // AbortSignal.timeout doesn't hold the loop open; a server always does
  try {
    assert.equal(await getJson("k"), null);
    assert.ok(Date.now() - t0 < REDIS_TIMEOUT_MS + 1000);
  } finally {
    clearInterval(alive);
    globalThis.fetch = saved.fetch;
    process.env.KV_REST_API_URL = saved.url;
    process.env.KV_REST_API_TOKEN = saved.token;
  }
});
