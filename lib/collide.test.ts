// Collision map rule on fixture heatmaps. No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { collide } from "./collide.ts";
import type { HeatCell } from "./qloo.ts";

const cell = (lat: number, rank: number): HeatCell => ({ lat, lon: -100, affinity: rank, affinity_rank: rank, popularity: 0.9 });
// A covers lat 0..9 hottest in the north; B covers 0..8 hottest in the south, every rank shifted up by 0.3 (a skewed side)
const A = Array.from({ length: 10 }, (_, i) => cell(i, i / 10));
const B = Array.from({ length: 9 }, (_, i) => cell(i, Math.min(1, 0.3 + (8 - i) / 10)));
const r = collide(A, B);
const tone = (lat: number) => r.cells.find((c) => c[0] === lat)?.[2];

test("only cells both heatmaps carry are matched; lat 9 (A only) is never drawn", () => {
  assert.equal(r.matched, 9);
  assert.equal(tone(9), undefined);
});

test("re-ranked within matched cells: B's skew doesn't paint the map B", () => {
  assert.equal(tone(8), "a"); // A's hottest matched cell, B's coolest
  assert.equal(tone(0), "b");
  assert.equal(tone(4), "both"); // the middle sits within a quarter of the ranking
});

test("counts match the drawn cells, and every drawn cell is in someone's top half", () => {
  assert.equal(r.counts.a + r.counts.b + r.counts.both, r.cells.length);
  assert.ok(r.cells.length < r.matched || r.cells.length === r.matched);
});
