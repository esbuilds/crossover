// The 60-second judge tour (Eric's features push, real Oct 14): three stops, each a page that already exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOUR, tourHref } from "./tour.ts";

test("three stops, in order: the ask, the blind replay, the counterexample", () => {
  assert.equal(TOUR.length, 3);
  assert.equal(tourHref(1), "/?tour=1");
  assert.equal(tourHref(2), "/ask/A539C8C9-4733-41A9-911A-11AC2B6D475A?t=urn%3Aentity%3Abrand&case=coca-cola-x-converse&tour=2");
  assert.equal(tourHref(3), "/audit?tour=3#counterexample");
  assert.equal(tourHref(4), "/");
});

test("each stop's line carries only numbers already published on the site", () => {
  const allowed = ["11", "14", "45", "6", "9"];
  for (const s of TOUR) for (const n of s.line.match(/\d+/g) ?? []) assert.ok(allowed.includes(n), `${n} in "${s.line}"`);
});
