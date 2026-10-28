// lib/ask/smaller.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { smallerFrom, smallerLine } from "./smaller.ts";
import type { Entity } from "../qloo.ts";

const e = (name: string, affinity: number, popularity: number): Entity => ({ entity_id: name, name, types: [], popularity, akas: [], tags: [], affinity });
const seed = { id: "SEED", name: "Liquid Death" };
// the Oct 18 probe's Liquid Death rows, trimmed
const uncapped = [e("Pepsi Nitro", 0.98, 0), e("Dr. Squatch", 0.869, 0.94), e("22Red", 0.869, 0.6), e("Fallen Footwear", 0.867, 0.8)];
const capped = [e("Ripple Junction", 0.866, 0.24), e("No Reading", 0.86, 0), e("Droplabs", 0.828, 0.46), e("Far Off", 0.7, 0.3)];
const get = async (p: Record<string, string | number>) => ("filter.popularity.max" in p ? capped : uncapped);

test("smaller: capped names within 0.05 of the leader, popularity 0 left out, the line from the rows", async () => {
  const s = (await smallerFrom(seed, get))!;
  assert.equal(s.leader.name, "Dr. Squatch"); // Pepsi Nitro has no popularity reading, so it can't lead
  assert.deepEqual(s.rows.map((r) => r.name), ["Ripple Junction", "Droplabs"]); // No Reading: popularity 0; Far Off: 0.169 below
  assert.match(smallerLine(s), /Ripple Junction, at popularity 0\.24, scores 0\.87: one of 2 brands under popularity 0\.5 within 0\.05/);
});

test("smaller: nothing within the gap says fame and fit go together", async () => {
  const s = (await smallerFrom(seed, async (p) => ("filter.popularity.max" in p ? [e("Far Off", 0.7, 0.3)] : uncapped)))!;
  assert.deepEqual(s.rows, []);
  assert.match(smallerLine(s), /No brand under popularity 0\.5 comes within 0\.05/);
});

test("the leader is labelled when it's the rival the agent set aside", () => {
  const s = { seed: "Allbirds", cap: 0.5, leader: { name: "Outdoor Voices", affinity: 0.94, popularity: 0.96 }, rows: [] };
  assert.match(smallerLine(s, { name: "Outdoor Voices", step: 2 }), /^Outdoor Voices, the rival the agent set aside in step 2, leads Allbirds fans' brands at 0\.94/);
  assert.match(smallerLine(s, { name: "Vuori", step: 2 }), /^Outdoor Voices leads/);
  assert.match(smallerLine(s), /^Outdoor Voices leads/);
});
