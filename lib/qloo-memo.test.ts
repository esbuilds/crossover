import test from "node:test";
import assert from "node:assert/strict";
import { cached } from "./qloo.ts";

// The heatmap memo: Redis is a stubbed fetch that counts GETs and hands back one stored value.
test("a memo cache reads Redis once per key; each read is the same value in a fresh object; a plain cache reads every time", async () => {
  const stored = JSON.stringify([{ lat: 40.7128, lon: -74.006, affinity: 0.912, affinity_rank: 0.5, popularity: 0.25 }]);
  let gets = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => (gets++, new Response(JSON.stringify([{ result: stored }])))) as typeof fetch;
  process.env.KV_REST_API_URL = "https://redis.test";
  process.env.KV_REST_API_TOKEN = "test";
  const live = async (seed: string, place: string): Promise<unknown> => { throw new Error(`no Qloo call in this test (${seed}, ${place})`); };
  try {
    const memo = cached("memo-test", live, { memo: true });
    const a = await memo.peek("seed", "United States");
    const b = await memo("seed", "United States");
    assert.equal(gets, 1, "the second read came from memory");
    assert.equal(JSON.stringify(a), stored);
    assert.equal(JSON.stringify(b), stored);
    assert.notEqual(a, b, "every caller gets its own object");

    gets = 0;
    const plain = cached("plain-test", live);
    await plain.peek("seed", "United States");
    await plain.peek("seed", "United States");
    assert.equal(gets, 2);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  }
});
