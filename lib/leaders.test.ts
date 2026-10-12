import { test } from "node:test";
import assert from "node:assert/strict";
import { leadersOf, regionShare } from "./leaders.ts";
import type { HeatCell } from "./qloo.ts";

const cell = (lat: number, lon: number, affinity_rank: number): HeatCell => ({ lat, lon, affinity: 0.5, affinity_rank, popularity: 0.5 });

test("the leader is the highest percentile among the cells all maps carry; below its own top half is blank", () => {
  // three cells all carry, plus one only A carries (ignored)
  const A = [cell(1, 1, 0.9), cell(1, 2, 0.1), cell(1, 3, 0.5), cell(9, 9, 1)];
  const B = [cell(1, 1, 0.2), cell(1, 2, 0.8), cell(1, 3, 0.3)];
  const C = [cell(1, 1, 0.3), cell(1, 2, 0.2), cell(1, 3, 0.1)];
  const { cells, common } = leadersOf([A, B, C]);
  assert.equal(common, 3);
  const at = Object.fromEntries(cells.map(([lat, lon, k]) => [`${lat},${lon}`, k]));
  assert.equal(at["1,1"], 0, "A ranks this cell top of its own pattern");
  assert.equal(at["1,2"], 1, "B leads here");
  assert.ok(!("9,9" in at), "a cell not all three carry is never drawn");
});

test("region share: one block per leader agrees, a checkerboard doesn't", () => {
  const block = [] as [number, number, number][];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) block.push([i, j, j < 3 ? 0 : 1]);
  const checker = block.map(([i, j]) => [i, j, (i + j) % 2] as [number, number, number]);
  assert.ok(regionShare(block) > 0.8, String(regionShare(block)));
  assert.ok(regionShare(checker) < 0.5, String(regionShare(checker)));
});
