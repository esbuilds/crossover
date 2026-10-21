import { test } from "node:test";
import assert from "node:assert/strict";
import { fairSentence, popularityFair, topThreeChance } from "./popularity-fair.ts";
import stored from "../audit/popularity-fair.json" with { type: "json" };

test("fair tie-break: an eight-way tie gives 3 in 8, two above and four tied gives 1 in 5", () => {
  assert.equal(topThreeChance(1, [1, 1, 1, 1, 1, 1, 1]), 3 / 8);
  assert.equal(topThreeChance(0.98, [1, 1, 0.98, 0.98, 0.98, 0.98, 0.5]), 1 / 5);
  assert.equal(topThreeChance(0.9, [1, 1, 1, 0.5, 0.5, 0.5, 0.5]), 0);
  assert.equal(topThreeChance(1, [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]), 1);
});

test("the published file matches the frozen replays: about 10.6 of 23, where the stored field reads 21", () => {
  const now = popularityFair();
  assert.equal(now.scored, 23);
  assert.equal(now.expectedTopThree, 10.6);
  assert.equal(now.storedTopThree, 21);
  assert.equal(now.affinityTopThree, 17);
  assert.deepEqual({ ...stored, builtAt: undefined, note: undefined }, { ...now, builtAt: undefined, note: undefined });
});

test("the /audit sentence prints the computed numbers", () => {
  assert.equal(fairSentence(stored), "Popularity alone, with ties broken fairly, puts the real partner in the top three about 10.6 of 23 times, against 17 of 23 for the seed's fans (both tests pooled, after the fact). The popularityRank field in the replay files breaks ties in the partner's favor and reads 21; it is not a result.");
});
