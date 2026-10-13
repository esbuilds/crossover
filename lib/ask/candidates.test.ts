// lib/ask/candidates.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { CANDIDATES, fromSplit, fromTop50 } from "./candidates.ts";
import type { Entity } from "../qloo.ts";
import type { RivalRow } from "../rivals.ts";

const DRINKS = "urn:tag:genre:brand:food_and_beverage:drinks";
const SKATE = "urn:tag:genre:brand:sports:skateboarding";
const e = (id: string, tag: string): Entity => ({ entity_id: id, name: id, types: ["urn:entity:brand"], popularity: 0.9, akas: [], tags: [{ tag_id: tag, name: tag, type: "urn:tag:genre" }] });
const row = (id: string): RivalRow => ({ id, name: id, kind: [], a: 0.9, b: 0.6, lean: "a", rankA: 1, rankB: null });

test("fromSplit keeps the seed column's order and stops at eight", () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(`B${i}`));
  assert.deepEqual(fromSplit(rows).map((c) => c.id), ["B0", "B1", "B2", "B3", "B4", "B5", "B6", "B7"]);
  assert.equal(CANDIDATES, 8);
});

test("fromTop50 drops the seed, excluded ids and same-field brands, keeps affinity order", () => {
  const seed = e("Liquid Death", DRINKS);
  const list = [e("Liquid Death", DRINKS), e("Celsius", DRINKS), e("Vans", SKATE), e("Rival", SKATE), ...Array.from({ length: 10 }, (_, i) => e(`S${i}`, SKATE))];
  const out = fromTop50(seed, list, ["Rival"]).map((c) => c.id);
  assert.deepEqual(out, ["Vans", "S0", "S1", "S2", "S3", "S4", "S5", "S6"]);
});
