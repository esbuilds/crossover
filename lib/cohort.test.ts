import test from "node:test";
import assert from "node:assert/strict";
import { AGES, strongestOf } from "./cohort.ts";

test("cohort: six brackets in order, strongest is the highest affinity, null when Qloo returned nothing", () => {
  assert.deepEqual(AGES, ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"]);
  const buckets = AGES.map((age, i) => ({ age, affinity: [0.81, 0.93, 0.9, null, 0.7, 0.62][i] }));
  assert.equal(strongestOf(buckets), "25_to_29");
  assert.equal(strongestOf(AGES.map((age) => ({ age, affinity: null }))), null);
});
