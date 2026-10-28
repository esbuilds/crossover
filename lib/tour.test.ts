// The 60-second judge tour: three stops, each a page that already exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTROL, TOUR, tourHref } from "./tour.ts";
import control from "../audit/replay-control.json" with { type: "json" };

test("four stops, in order: the ask, the blind replay, the counterexample, the challenge", () => {
  assert.equal(TOUR.length, 4);
  assert.equal(tourHref(1), "/?tour=1");
  assert.equal(tourHref(2), "/ask/A539C8C9-4733-41A9-911A-11AC2B6D475A?t=urn%3Aentity%3Abrand&case=coca-cola-x-converse&tour=2");
  assert.equal(tourHref(3), "/audit?tour=3#counterexample");
  assert.equal(tourHref(4), "/replay?tour=4");
  assert.equal(tourHref(5), "/");
});

test("each stop's line carries only numbers already published on the site", () => {
  const allowed = ["45", "23", "17"]; // 23 replay cases and 17 hits, real and scrambled, on /audit (the control's summary)
  for (const s of TOUR) for (const n of s.line.match(/\d+/g) ?? []) assert.ok(allowed.includes(n), `${n} in "${s.line}"`);
});

test("the tour's replay numbers are the published control's", () => {
  assert.deepEqual(CONTROL, { cases: control.summary.cases, realHits: control.summary.realHits, scrambledHits: control.summary.scrambledHits });
});
