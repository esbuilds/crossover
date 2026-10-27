// The three step pictures on /, shaped from an ask's events. The asks are the demo world (lib/ask/demo/, made by
// scripts/demo-world.ts): invented names, ids and scores in the shape of three cached asks, so no Qloo data is in the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { answerOf, callCard, cardsStep, checkerLine, dumbbellStep, mapStep, replayLine, stepsFrom, twinsStep } from "./steps.ts";
import control from "../../audit/replay-control.json" with { type: "json" };
import mutation from "../../audit/mutation.json" with { type: "json" };
import type { AskEvent } from "./agent.ts";

const load = (name: string): AskEvent[] => JSON.parse(readFileSync(new URL(`./demo/${name}.json`, import.meta.url), "utf8"));
const ld = stepsFrom(load("calder-shoe"));
const mj = stepsFrom(load("low-tide-choir"));

test("stepsFrom pairs each call with its result, in step order", () => {
  assert.deepEqual(ld.map((s) => s.tool), ["resolve", "findRival", "split", "candidates", "review", "twins"]);
  assert.ok(ld.every((s) => s.why.length > 0 && s.output));
});

test("mapStep: Calder Shoe's split links /vs with both ids and carries the counts; Low Tide Choir has no split", () => {
  const m = mapStep(ld)!;
  assert.equal(m.href, "/vs/0FC5E2E4-8A8E-45D4-B79A-0A6C967D32CD/D344054F-24F1-44A9-ACD3-0A46860DA77E?ta=urn%3Aentity%3Abrand&tb=urn%3Aentity%3Abrand");
  assert.deepEqual([m.closerToSeed, m.closerToRival], [12, 39]);
  assert.equal(m.seedMarkets[0], "Fort Worth");
  assert.equal(mapStep(mj), null);
});

test("cardsStep: eight cards in taste order with ids and fame bands; Low Tide Choir leads with Brightwell Optics 0.97", () => {
  const c = cardsStep(mj)!;
  assert.equal(c.cards.length, 8);
  assert.deepEqual([c.cards[0].name, c.cards[0].affinity], ["Brightwell Optics", 0.97]);
  assert.ok(c.cards.every((x) => x.id.length > 0 && x.fameBand >= 0));
  assert.equal(c.fameFlat, false); // one taste group: the fame line's rule needs more than one
});

test("cardsStep: the fame line shows only under its existing rule", () => {
  const steps = [
    { n: 1, tool: "candidates", why: "x", summary: "", output: { candidates: ["A", "B", "C", "D"].map((name) => ({ name, id: name })) } },
    { n: 2, tool: "review", why: "x", summary: "", output: { groups: [[{ name: "A", affinity: 0.9 }], [{ name: "B", affinity: 0.8 }, { name: "C", affinity: 0.79 }, { name: "D", affinity: 0.78 }]], fameBands: [[{ name: "A" }, { name: "B" }, { name: "C" }], [{ name: "D" }]], notMeasured: [] } },
  ];
  assert.equal(cardsStep(steps)!.fameFlat, true);
});

test("twinsStep: nothing to draw when no pair stands out", () => {
  assert.equal(twinsStep(ld), null);
  assert.deepEqual(twinsStep([{ n: 1, tool: "twins", why: "x", summary: "", output: { found: true, a: { name: "REI" }, b: { name: "Patagonia" }, value: 0.97, next: 0.89 } }]), { a: "REI", b: "Patagonia", value: 0.97, next: 0.89 });
});

// REPLAY-LINE (real Oct 22): the line under the decision reads the control's summary, never a typed number.
test("replayLine: the pooled replay beside the scrambled-seed control, from the published summary", () => {
  assert.equal(
    replayLine(control.summary),
    "Against 23 real deals it never saw, the real partner made the top three 17 times, and 17 times again with the wrong seed brand swapped in. So the replay measures how the candidate lists were built. Details on /audit.",
  );
});

// PROOF-LINE (real Oct 22): the line under every answer is the checker's attacked count, read from the gate's file.
test("checkerLine: the mutation gate's count and the misses, from the published file", () => {
  assert.equal(
    checkerLine(mutation.gated),
    "Every name and number above is matched to a measured step. We attacked that check with 230 altered answers; it caught 219, and the 11 that got through are listed on /audit.",
  );
});

// The world-class brief (Oct 14): step 5 draws a dumbbell, fame (Qloo popularity) at one end, taste (affinity) at
// the other, one row per candidate, sorted by the gap between them; unmeasured names last.
test("dumbbellStep: rows sorted by taste minus fame, unmeasured last", () => {
  const steps = [
    { n: 1, tool: "review", why: "x", summary: "", output: { groups: [[{ name: "A", affinity: 0.95, popularity: 0.99 }, { name: "B", affinity: 0.94, popularity: 0.6 }], [{ name: "C", affinity: 0.8, popularity: 0.7 }]], notMeasured: [{ name: "D" }] } },
  ];
  const d = dumbbellStep(steps)!;
  assert.deepEqual(d.rows.map((r) => r.name), ["B", "C", "A", "D"]);
  assert.deepEqual(d.rows[0], { name: "B", fame: 0.6, taste: 0.94 });
  assert.equal(d.rows[3].fame, null);
  assert.equal(d.rows[3].taste, null);
});

test("dumbbellStep: nothing to draw without popularity in the review output (asks cached before the field)", () => {
  assert.equal(dumbbellStep(ld), null); // like the recorded ask it's shaped from, this one predates the field
});

// the two prepared asks as recaptured after the dumbbell re-warm (real Oct 14): both draw eight rows
test("dumbbellStep on the prepared asks: the artist ask (one tied group) and the brand ask (with a split)", () => {
  const ab = stepsFrom(load("corvid-co"));
  for (const steps of [mj, ab]) {
    const d = dumbbellStep(steps)!;
    assert.equal(d.rows.length, 8);
    const measured = d.rows.filter((r) => r.fame !== null);
    assert.ok(measured.every((r) => r.fame! > 0 && r.fame! <= 1 && r.taste !== null));
    const gaps = measured.map((r) => r.taste! - r.fame!);
    assert.deepEqual(gaps, [...gaps].sort((a, b) => b - a)); // widest taste-over-fame first
    // a popularity of 0 is Qloo's missing value, never the widest gap: it reads as no measurement, after the measured rows
    const firstMissing = d.rows.findIndex((r) => r.fame === null);
    if (firstMissing >= 0) assert.ok(d.rows.slice(firstMissing).every((r) => r.fame === null));
  }
  assert.equal(dumbbellStep(stepsFrom(load("corvid-co")))!.rows.find((r) => r.name === "Wren & Lark")!.fame, null);
  {
  }
  const m = mapStep(ab)!;
  assert.deepEqual([m.seed.name, m.rival.name, m.closerToSeed, m.closerToRival, m.withinGapOfBoth], ["Corvid & Co.", "Brightwell Optics", 2, 4, 50]);
});

// The tie ruling (Oct 14): a two-line call card from existing outputs, two labels, never fused into one claim.
test("callCard: the first call and where the seed's audience leads, as two separate lines", () => {
  const ab = stepsFrom(load("corvid-co"));
  const decision = load("corvid-co").findLast((e) => e.type === "decision") as Extract<AskEvent, { type: "decision" }>;
  const card = callCard(ab, decision.decision!)!;
  assert.equal(card.first, "First call: Larkspur Labs.");
  assert.equal(card.where, "Where Corvid & Co.'s audience leads: Birmingham, Washington DC and Oklahoma City.");
  // never one recommendation: the call line names no place, the place line names no call
  for (const c of decision.decision!.calls) assert.ok(!card.where!.includes(c.name.replace(/\[\[|\]\]/g, "")));
  assert.ok(!/\b(in|for|test)\b/.test(card.first.replace("First call:", "")));
  const mjDecision = load("low-tide-choir").findLast((e) => e.type === "decision") as Extract<AskEvent, { type: "decision" }>;
  const mjCard = callCard(mj, mjDecision.decision!)!;
  assert.equal(mjCard.first, "First call: Brightwell Optics.");
  assert.equal(mjCard.where, null); // no split, so no market in any step: no line
});

// A-1 (real Oct 27): a typed name Qloo doesn't know resolves to nothing, and the agent's decision passes the checker with
// no calls. That's no answer: the page must not render one (fool-it.tsx read calls[0].reason and the page crashed).
test("answerOf: a passing decision with no calls is no answer; a passing one with calls is", () => {
  const unknown = [
    { type: "call", n: 1, tool: "resolve", why: "" },
    { type: "result", n: 1, summary: "Qloo doesn't know \"Nobody's Pickle Co.\"", output: { state: "unresolved", name: "Nobody's Pickle Co." } },
    { type: "decision", decision: { calls: [], cautions: [], summary: [{ text: "Qloo doesn't know [[Nobody's Pickle Co.]], so there is nothing to measure.", steps: [1] }] }, check: { ok: true } },
  ] as AskEvent[];
  assert.equal(answerOf(unknown), null);
  assert.equal(answerOf(load("low-tide-choir"))?.calls[0].name, "Brightwell Optics");
});
