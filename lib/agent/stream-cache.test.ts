// Final review, Important 2: the generation must see the IP of the request it runs for, not a shared variable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { streamCache, type Streamed } from "./stream-cache.ts";

test("gen receives the waiting request's ip", async () => {
  const run = streamCache<{ k: string }, Streamed>("ip-test", "v1", (i) => i.k, async (_i, _say, _write, ip) => ({ text: ip ?? "none", trace: [] }));
  const r = await run({ k: `a${Math.random()}` }, "203.0.113.7", () => {}, () => {});
  assert.equal(r.text, "203.0.113.7");
});

test("peek reads the cache only: an input never run comes back null, and nothing generates", async () => {
  let ran = false;
  const run = streamCache<{ k: string }, Streamed>("peek-test", "v1", (i) => i.k, async () => ((ran = true), { text: "", trace: [] }));
  assert.equal(await run.peek({ k: `never${Math.random()}` }), null);
  assert.equal(ran, false);
});
