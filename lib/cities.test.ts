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

test("refine regions keep only markets in the listed states, over-index unchanged", async () => {
  const { inStates } = await import("./cities.ts");
  const ranked = rankMetros([cell(30.27, -97.74, 0.9), cell(30.3, -97.7, 0.7), cell(40.71, -74.0, 0.6), cell(40.75, -73.98, 0.6)]);
  const tx = inStates(ranked, ["TX"]);
  assert.deepEqual(tx.map((m) => m.name), ["Austin"]);
  assert.equal(tx[0].overIndex, ranked.find((m) => m.name === "Austin")!.overIndex);
  assert.equal(inStates(ranked, null).length, 2);
});

test("satellite cities fold into their market", () => {
  const ranked = rankMetros([cell(33.98, -117.37, 0.9), cell(33.95, -117.4, 0.9)]); // Riverside
  assert.deepEqual(ranked.map((m) => m.name), ["Los Angeles"]);
});

test("markets are one per market: centers at least 100 km apart, 45 to 55 of them", async () => {
  const { default: markets } = await import("../data/metros.json", { with: { type: "json" } });
  assert.ok(markets.length >= 45 && markets.length <= 55, `${markets.length} markets`);
  const rad = Math.PI / 180;
  for (const [i, a] of markets.entries())
    for (const b of markets.slice(i + 1)) {
      const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
      const km = 12742 * Math.asin(Math.sqrt(h));
      assert.ok(km >= 100, `${a.name} and ${b.name} are ${Math.round(km)} km apart`);
    }
});

test("ties on over-index go to the market with more qualifying cells", () => {
  const ranked = rankMetros([
    cell(30.27, -97.74, 0.8), cell(30.3, -97.7, 0.8), // Austin: 2 popular cells
    cell(40.71, -74.0, 0.8), cell(40.75, -73.98, 0.8), cell(40.65, -73.95, 0.8), // New York: 3 popular cells
  ]);
  assert.deepEqual(ranked.map((m) => [m.name, m.overIndex]), [["New York", 100], ["Austin", 100]]);
});
