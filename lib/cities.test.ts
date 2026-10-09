// Metro aggregation on synthetic cells. No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankMetros } from "./cities.ts";

const cell = (lat: number, lon: number, affinity_rank: number, popularity = 0.9) => ({ lat, lon, affinity: affinity_rank, affinity_rank, popularity });

test("nearest metro within 40 km, mean affinity_rank, at least 2 popular cells", () => {
  const ranked = rankMetros([
    cell(30.27, -97.74, 0.9), cell(30.3, -97.7, 0.7), // Austin: mean 0.8
    cell(40.71, -74.0, 0.6), cell(40.75, -73.98, 0.6), // New York: mean 0.6
    cell(29.42, -98.49, 0.99, 0.1), cell(29.45, -98.5, 0.99, 0.2), // San Antonio: high score but not popular, dropped
    cell(31.0, -100.0, 1), // west Texas, >40 km from any metro, ignored
  ]);
  assert.deepEqual(ranked.map((m) => m.name), ["Austin", "New York"]);
  assert.equal(ranked[0].score, 0.8);
  assert.equal(ranked[0].cells, 2);
  // national mean of all 7 cells is 0.826, so Austin (0.8) indexes at 97
  assert.equal(ranked[0].overIndex, 97);
});
