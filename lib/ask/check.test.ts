// lib/ask/check.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDecision, claimCount, displayName, forDisplay, nameForDisplay, unbracket, type Decision, type StepRecord } from "./check.ts";

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

// Rule v2 (Fable's judge-probe ruling, real Oct 15): Noah Kahan's true caution was blocked because the numbers after
// "against" were charged to the brand before it. A contrast marker ends the first brand's segment; what follows binds to
// the next bracketed brand, or with none, to some other candidate. Every number must still be in a cited step.
test("rule v2: a contrast clause's numbers bind to the others, not the first brand, and still can't leak", () => {
  const s4: StepRecord[] = [steps[0], { ...steps[1], output: { groups: [[{ name: "A", affinity: 0.94, popularity: 0.69 }, { name: "B", affinity: 0.8, popularity: 0.95 }, { name: "C", affinity: 0.79, popularity: 0.99 }]] } }];
  const say = (text: string) => checkDecision({ ...ok, calls: [], cautions: [], summary: [{ text, steps: [2] }] }, s4);
  assert.deepEqual(say("[[A]] sits in a lower fame band with popularity 0.69, against 0.95 to 0.99 for the others."), { ok: true });
  assert.deepEqual(say("[[A]] scores 0.94, against 0.80 for [[B]]."), { ok: true });
  assert.equal(say("[[A]] scores 0.94, against 0.79 for [[B]].").ok, false); // the leak: 0.79 is C's, not B's
  assert.equal(say("[[A]] scores 0.94, against 0.94 for the others.").ok, false); // A's own number can't stand for the others
  assert.equal(say("[[A]] scores 0.95, against 0.80 for [[B]].").ok, false); // before the marker, still A's own
});

// Fable's checker sign-off (Oct 15): "with seven others between 0.94 and 0.95" is a contrast clause too.
test("rule v2: a count of others binds as 'the others' does", () => {
  const s5: StepRecord[] = [steps[0], { ...steps[1], output: { groups: [[{ name: "A", affinity: 0.97 }, { name: "B", affinity: 0.95 }, { name: "C", affinity: 0.94 }]] } }];
  const say = (text: string) => checkDecision({ ...ok, calls: [], cautions: [], summary: [{ text, steps: [2] }] }, s5);
  assert.deepEqual(say("[[A]] sits closest at 0.97, with seven others between 0.94 and 0.95."), { ok: true });
  assert.equal(say("[[A]] sits closest at 0.97, with seven others at 0.97.").ok, false); // A's own number can't stand for the others
});

// Agency persona (Oct 14): "twins" is an internal name; the reader sees "the overlap check". Brand names stay.
// Rule v3 (mutation gate, real Oct 18): tampered copies of cached answers slipped through when the number sat after the
// seed's bracket, or was a rank (every rank 1 to 50 sits somewhere in a top-50 step).
test("rule v3: the seed's bracket doesn't end a brand's segment, and ranks bind too", () => {
  const say = (text: string) => checkDecision({ ...ok, calls: [], cautions: [], summary: [{ text, steps: [2] }] }, steps);
  assert.deepEqual(say("[[Allbirds]] has the top score under [[Mt. Joy]] fans at 0.95 and ranks 2 among them."), { ok: true });
  assert.equal(say("[[Allbirds]] has the top score under [[Mt. Joy]] fans at 0.91 and ranks 2 among them.").ok, false); // 0.91 is REI's
  assert.equal(say("[[Allbirds]] has the top score under [[Mt. Joy]] fans at 0.95 and ranks 1 among them.").ok, false); // rank is 2
});

test("rule v3: after the seed's fans are named, a contrast may give the brand's own score under the other side", () => {
  const s6: StepRecord[] = [steps[0], { ...steps[1], output: { rows: [{ name: "quip", a: 0.91, b: 0.84 }, { name: "Casamara Club", affinity: 0.7 }] } }];
  const say = (text: string) => checkDecision({ ...ok, calls: [], cautions: [], summary: [{ text, steps: [2] }] }, s6);
  assert.deepEqual(say("[[quip]] scores 0.91 under [[Mt. Joy]] fans, against 0.84 under [[Casamara Club]] fans."), { ok: true });
  assert.equal(say("[[quip]] scores 0.91, against 0.84 for the others.").ok, false); // no seed named: v2 holds
});

test("forDisplay: the twins tool reads as the overlap check; a brand named Twins doesn't change", () => {
  assert.equal(forDisplay("Twins found no pair that reaches the same audience."), "The overlap check found no pair that reaches the same audience.");
  assert.equal(forDisplay("so twins gives no pair to keep apart."), "so the overlap check gives no pair to keep apart.");
  assert.equal(forDisplay("[[Minnesota Twins]] scores 0.90."), "Minnesota Twins scores 0.90.");
  assert.equal(forDisplay("Minnesota Twins fans"), "Minnesota Twins fans");
});

test("claimCount counts the names, decimals and ranks the checker binds", () => {
  // call: Allbirds, 0.95, #2; caution: REI, Patagonia, 0.97, 0.89; summary: Allbirds
  assert.equal(claimCount(ok), 8);
});

test("v3.1: a rank that ends the sentence is bound to the brand it's said of (builder 2's gap, real Oct 22)", () => {
  const steps = [{ n: 1, tool: "resolve", why: "", summary: "", output: { state: "confirmed", name: "Allbirds" } }, { n: 2, tool: "otherWay", why: "", summary: "", output: { rows: [{ name: "Bombas", rank: 1 }, { name: "Tuft & Needle", rank: 9 }] } }];
  const d = (t: string) => checkDecision({ calls: [{ name: "Bombas", reason: t, steps: [2] }], cautions: [], summary: [] }, steps);
  assert.deepEqual(d("[[Bombas]] fans rank [[Allbirds]] 9."), { ok: false, problems: ["call 1: 9 isn't Bombas's own number"] });
  assert.deepEqual(d("[[Bombas]] fans rank [[Allbirds]] 1."), { ok: true });
});
