// Pairing verdict classification and slate badges, from fixture ranks. No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, badgeFor } from "./fit.ts";

test("both directions in the fans' top 10 is an affinity play", () => {
  assert.deepEqual(classify(3, 7), { kind: "affinity" });
});

test("partial both ways is still an affinity play (both directions present)", () => {
  assert.deepEqual(classify(26, 40), { kind: "affinity" });
});

test("one top 10 and one outside the top 50 is one-way, naming whose fans carry it", () => {
  // A's fans love B (B is #2 among A's fans); B's fans don't rank A
  assert.deepEqual(classify(null, 2), { kind: "one-way", strongSide: "b" });
  assert.deepEqual(classify(5, null), { kind: "one-way", strongSide: "a" });
});

test("both outside the top 50 is a contrast play", () => {
  assert.deepEqual(classify(null, null), { kind: "contrast" });
});

test("badges: top 10 is mutual, top 50 is partial, else none", () => {
  assert.equal(badgeFor(1), "mutual");
  assert.equal(badgeFor(10), "mutual");
  assert.equal(badgeFor(11), "partial");
  assert.equal(badgeFor(50), "partial");
  assert.equal(badgeFor(null), null);
});
