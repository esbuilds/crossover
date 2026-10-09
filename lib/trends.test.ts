import test from "node:test";
import assert from "node:assert/strict";
import { classifyTrends } from "./trends.ts";

test("durable holds with trends off, trending only shows with trends high, agreement gives nothing", () => {
  const kept = ["a", "b", "c", "d"];
  const off = ["a", "x", "y"];
  const high = ["b", "a", "z"];
  assert.deepEqual(classifyTrends(kept, off, high), { a: "durable", b: "trending" }); // c and d appear in neither
  assert.deepEqual(classifyTrends(kept, ["a", "b"], ["b", "a"]), {}); // same ten either way: trends move nothing
  assert.deepEqual(classifyTrends([], off, high), {});
});
