// The replay challenge (Fable's re-judge ruling, Oct 15): all 23 frozen cases, complete, and the published tallies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHALLENGE, PROTOCOL } from "./replay-challenge.ts";
import { rotation } from "./replay-rotation.ts";

test("all 23 scored cases are in, each with eight scored names, alphabetical, and the published rank", () => {
  assert.equal(CHALLENGE.length, 23);
  assert.equal(new Set(CHALLENGE.map((c) => c.key)).size, 23);
  assert.equal(CHALLENGE.filter((c) => c.test === "v1").length, PROTOCOL.v1.scored);
  assert.equal(CHALLENGE.filter((c) => c.test === "v2").length, PROTOCOL.v2.scored);
  assert.equal(CHALLENGE.filter((c) => c.test === "v1" && c.hit).length, PROTOCOL.v1.hits); // 6 of 9
  assert.equal(CHALLENGE.filter((c) => c.test === "v2" && c.hit).length, PROTOCOL.v2.hits); // 11 of 14
  for (const c of CHALLENGE) {
    assert.equal(c.eight.length, 8);
    assert.ok(c.eight.some((x) => x.name === c.partner));
    assert.deepEqual(c.eight.map((x) => x.name), [...c.eight.map((x) => x.name)].sort((a, b) => a.localeCompare(b)));
  }
});

test("rotation: every case once, misses included, the same order for the same seed", () => {
  const keys = CHALLENGE.map((c) => c.key);
  const r = rotation(keys, 12345);
  assert.deepEqual([...r].sort(), [...keys].sort());
  assert.deepEqual(rotation(keys, 12345), r); // a refresh with the saved seed resumes the same order
  assert.ok(CHALLENGE.filter((c) => !c.hit).every((c) => r.includes(c.key)));
});

test("repeated sets of eight are counted (the sneaker aisle shows up more than once)", () => {
  assert.ok(CHALLENGE.some((c) => c.sameEight > 1));
  for (const c of CHALLENGE) assert.equal(c.sameEight, CHALLENGE.filter((x) => x.eight.map((y) => y.name).join() === c.eight.map((y) => y.name).join()).length);
});
