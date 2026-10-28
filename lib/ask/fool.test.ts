// lib/ask/fool.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEdit, nudge, rebracket } from "./fool.ts";
import { forDisplay, type Decision, type StepRecord } from "./check.ts";

const steps: StepRecord[] = [
  { n: 1, tool: "resolve", why: "", summary: "", output: { state: "confirmed", name: "Mt. Joy" } },
  { n: 2, tool: "review", why: "", summary: "", output: { groups: [[{ name: "Allbirds", affinity: 0.95 }, { name: "REI", affinity: 0.91 }]], ranks: [{ name: "Allbirds", amongSeedFans: 2 }] } },
];
const decision: Decision = { calls: [{ name: "Allbirds", reason: "[[Allbirds]] leads under [[Mt. Joy]] fans at 0.95 and ranks 2 among them.", steps: [2] }], cautions: [], summary: [] };
const shown = forDisplay(decision.calls[0].reason);
const edit = (t: string) => checkEdit(decision, steps, shown, t);

test("fool it: the untouched reason passes; a nudged score, a changed rank and a typed-in brand are rejected", () => {
  assert.deepEqual(edit(shown), { ok: true });
  assert.equal(edit(nudge(shown)).ok, false);
  assert.equal(edit(shown.replace("ranks 2", "ranks 1")).ok, false);
  assert.equal(edit(shown.replace("Allbirds", "Nike")).ok, false); // unbracketed, never measured: bracketed by rebracket
  assert.equal(edit(shown.replace("Allbirds", "REI")).ok, false); // measured, but 0.95 isn't REI's
});

test("rebracket: known names get their brackets back, a new name is bracketed, common words aren't", () => {
  assert.equal(rebracket(decision.calls[0].reason, shown, shown), decision.calls[0].reason);
  assert.equal(rebracket(decision.calls[0].reason, shown, `${shown} The Nike deal fits.`), `${decision.calls[0].reason} The [[Nike]] deal fits.`);
});

// a name Qloo doesn't know ends in a passing decision with no calls; the box has no reason to edit
test("fool it: a decision with no calls is rejected, not a crash", () => {
  const none: Decision = { calls: [], cautions: [], summary: [{ text: "Qloo doesn't know [[Nobody's Pickle Co.]], so there is nothing to measure.", steps: [1] }] };
  assert.equal(checkEdit(none, steps, "", "anything").ok, false);
});
