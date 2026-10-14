// lib/ask/check.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDecision, displayName, forDisplay, nameForDisplay, unbracket, type Decision, type StepRecord } from "./check.ts";

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

// Found on the first live run (Liquid Death, Oct 13): the model bracketed calls[].name, and named the seed in sentences
// citing later steps. The seed is the subject of every step, so a confirmed resolve step's name counts everywhere.
test("calls[].name may arrive bracketed", () => {
  const d = { ...ok, calls: [{ name: "[[Allbirds]]", reason: "[[Allbirds]] leads at 0.95.", steps: [2] }] };
  assert.deepEqual(checkDecision(d, steps), { ok: true });
});

test("the resolved seed's name counts in any sentence; other names still need their step", () => {
  assert.deepEqual(checkDecision({ ...ok, summary: [{ text: "For [[Mt. Joy]], start with [[Allbirds]].", steps: [2] }] }, steps), { ok: true });
  assert.equal(checkDecision({ ...ok, summary: [{ text: "For [[Mt. Joy]], start with [[Patagonia]].", steps: [2] }] }, steps).ok, false);
});

// Final review, Important 4: a score quoted for one brand must be that brand's score, not any number in the step.
test("a decimal quoted next to one brand must be that brand's own number", () => {
  assert.equal(checkDecision({ ...ok, summary: [{ text: "[[REI]] leads at 0.95.", steps: [2] }] }, steps).ok, false);
  assert.deepEqual(checkDecision({ ...ok, summary: [{ text: "[[REI]] sits at 0.91.", steps: [2] }] }, steps), { ok: true });
});

// Found re-warming Mt. Joy after the binding rule: "within 0.05 of the top" quotes the method's gap, not a brand score.
test("a method number (under method) may sit next to one brand; brand scores still bind", () => {
  const withMethod: StepRecord[] = [...steps.slice(0, 1), { ...steps[1], output: { ...(steps[1].output as object), method: { gap: 0.05 } } }, steps[2]];
  assert.deepEqual(checkDecision({ ...ok, summary: [{ text: "[[REI]] sits within 0.05 of the top.", steps: [2] }] }, withMethod), { ok: true });
  assert.equal(checkDecision({ ...ok, summary: [{ text: "[[REI]] leads at 0.95.", steps: [2] }] }, withMethod).ok, false);
});

// Found re-warming Mt. Joy: a range sentence names one brand but its numbers are the group's. Binding applies only to
// decimals right after the first brand named, before any other name.
test("a group range next to one brand passes; a score right after a brand's name must be its own", () => {
  const s3: StepRecord[] = [steps[0], { ...steps[1], output: { groups: [[{ name: "Allbirds", affinity: 0.95 }, { name: "REI", affinity: 0.91 }, { name: "Hydro Flask", affinity: 0.9 }]], ranks: [{ name: "Allbirds", amongSeedFans: 2 }] } }];
  assert.deepEqual(checkDecision({ ...ok, cautions: [], summary: [{ text: "All three scored between 0.90 and 0.95, with [[Allbirds]] at the top.", steps: [2] }] }, s3), { ok: true });
  assert.deepEqual(checkDecision({ ...ok, cautions: [], summary: [{ text: "[[REI]] scores 0.91, close to [[Allbirds]] (0.95).", steps: [2] }] }, s3), { ok: true });
  assert.equal(checkDecision({ ...ok, cautions: [], summary: [{ text: "[[REI]] scores 0.95, ahead of [[Allbirds]].", steps: [2] }] }, s3).ok, false);
});

// Fable round 4 follow-up (Oct 13): Qloo names the entity "Alternative"; its own description says "Alternative Apparel".
// The page shows the brand name, the checker keeps matching Qloo's.
test("displayName renders a bare Qloo name as its brand, in brackets or plain names", () => {
  assert.equal(displayName("Alternative"), "Alternative Apparel");
  assert.equal(displayName("Allbirds"), "Allbirds");
  assert.equal(forDisplay("[[Alternative]] scores 0.95."), "Alternative Apparel scores 0.95.");
  assert.equal(unbracket("[[Alternative]] scores 0.95."), "Alternative scores 0.95."); // the checker reads Qloo's name
});

// Persona test, Oct 14 (judge): the frozen call's name arrives unbracketed ("Alternative"), so the display name applies
// to plain names too.
test("nameForDisplay: bracketed or plain, the display name applies", () => {
  assert.equal(nameForDisplay("Alternative"), "Alternative Apparel");
  assert.equal(nameForDisplay("[[Alternative]]"), "Alternative Apparel");
  assert.equal(nameForDisplay("Bombas"), "Bombas");
});
