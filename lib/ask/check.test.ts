// lib/ask/check.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDecision, unbracket, type Decision, type StepRecord } from "./check.ts";

const steps: StepRecord[] = [
  { n: 1, tool: "resolve", why: "", summary: "", output: { state: "confirmed", name: "Mt. Joy" } },
  { n: 2, tool: "review", why: "", summary: "", output: { groups: [[{ name: "Allbirds", affinity: 0.95 }, { name: "REI", affinity: 0.91 }]], ranks: [{ name: "Allbirds", amongSeedFans: 2 }] } },
  { n: 3, tool: "twins", why: "", summary: "", output: { a: { name: "REI" }, b: { name: "Patagonia" }, value: 0.97, next: 0.89 } },
];
const ok: Decision = {
  calls: [{ name: "Allbirds", reason: "[[Allbirds]] leads at 0.95 and is #2 among the fans' brands.", steps: [2] }],
  cautions: [{ text: "[[REI]] and [[Patagonia]] sit at 0.97 with each other, next pair 0.89.", steps: [3] }],
  summary: [{ text: "Start with [[Allbirds]].", steps: [2] }],
};

test("a decision that matches its cited steps passes", () => {
  assert.deepEqual(checkDecision(ok, steps), { ok: true });
});

test("a call naming a brand no cited step measured is rejected", () => {
  const d = { ...ok, calls: [{ name: "Nike", reason: "[[Nike]] fits.", steps: [2] }] };
  const r = checkDecision(d, steps);
  assert.equal(r.ok, false);
  assert.match((r as { problems: string[] }).problems.join(" "), /Nike/);
});

test("a bracketed name cited to the wrong step is rejected", () => {
  const d = { ...ok, cautions: [{ text: "[[Patagonia]] doubles [[REI]].", steps: [2] }] };
  assert.equal(checkDecision(d, steps).ok, false);
});

test("a number not in a cited step is rejected; decimals compare at two places", () => {
  assert.equal(checkDecision({ ...ok, summary: [{ text: "[[Allbirds]] at 0.96.", steps: [2] }] }, steps).ok, false);
  assert.equal(checkDecision({ ...ok, summary: [{ text: "[[Allbirds]] at 0.950.", steps: [2] }] }, steps).ok, true);
});

test("an unbracketed name that the run measured still has to be cited", () => {
  assert.equal(checkDecision({ ...ok, summary: [{ text: "Skip Patagonia for now.", steps: [2] }] }, steps).ok, false);
});

test("a sentence with no step, or a step that doesn't exist, is rejected", () => {
  assert.equal(checkDecision({ ...ok, summary: [{ text: "Start with [[Allbirds]].", steps: [] }] }, steps).ok, false);
  assert.equal(checkDecision({ ...ok, summary: [{ text: "Start with [[Allbirds]].", steps: [9] }] }, steps).ok, false);
});

test("unbracket renders names plainly", () => {
  assert.equal(unbracket("Call [[REI]] first."), "Call REI first.");
});
