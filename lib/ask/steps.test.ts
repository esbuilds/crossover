// The three step pictures on / (Pick A), shaped from an ask's recorded events. Fixtures are derived step outputs
// captured from the production cache (names, ids, two-decimal scores), not raw Qloo responses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { callCard, cardsStep, dumbbellStep, mapStep, replayLine, stepsFrom, twinsStep } from "./steps.ts";
import type { AskEvent } from "./agent.ts";

const load = (name: string): AskEvent[] => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const ld = stepsFrom(load("liquid-death"));
const mj = stepsFrom(load("mt-joy"));

test("stepsFrom pairs each call with its result, in step order", () => {
  assert.deepEqual(ld.map((s) => s.tool), ["resolve", "findRival", "split", "candidates", "review", "twins"]);
  assert.ok(ld.every((s) => s.why.length > 0 && s.output));
});

test("mapStep: Liquid Death's split links /vs with both ids and carries the counts; Mt. Joy has no split", () => {
  const m = mapStep(ld)!;
  assert.equal(m.href, "/vs/4DF7C265-52D9-4A99-8803-F62C2302D561/8E104A95-D942-4B31-88AC-07B26D1DE219?ta=urn%3Aentity%3Abrand&tb=urn%3Aentity%3Abrand");
  assert.deepEqual([m.closerToSeed, m.closerToRival], [12, 39]);
  assert.equal(m.seedMarkets[0], "Los Angeles");
  assert.equal(mapStep(mj), null);
});

test("cardsStep: eight cards in taste order with ids and fame bands; Mt. Joy leads with Outdoor Voices 0.97", () => {
  const c = cardsStep(mj)!;
  assert.equal(c.cards.length, 8);
  assert.deepEqual([c.cards[0].name, c.cards[0].affinity], ["Outdoor Voices", 0.97]);
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

// Fable round 5 ruling 1: the line under the decision reads two numbers, never one, from the two frozen tests.
test("replayLine states both frozen tests, never a pooled number", () => {
  assert.equal(
    replayLine({ hits: 6, scored: 9 }, { hits: 11, scored: 14 }),
    "Against real deals it never saw, the protocol put the real partner in the top three 6 of 9 times (v1) and 11 of 14 times (v2). Each is a frozen test; details on /audit.",
  );
});

// Pick 1 (world-class brief, Oct 14): step 5 draws a dumbbell, fame (Qloo popularity) at one end, taste (affinity) at
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
  assert.equal(dumbbellStep(ld), null); // Liquid Death's fixture predates the field
});

// the two prepared asks as recaptured after the Pick 1 re-warm (real Oct 14): both draw eight rows
test("dumbbellStep on the prepared asks: Mt. Joy (the tied hero fallback) and Allbirds (the map hero)", () => {
  const ab = stepsFrom(load("allbirds"));
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
  assert.equal(dumbbellStep(stepsFrom(load("allbirds")))!.rows.find((r) => r.name === "Quince")!.fame, null);
  {
  }
  const m = mapStep(ab)!;
  assert.deepEqual([m.seed.name, m.rival.name, m.closerToSeed, m.closerToRival, m.withinGapOfBoth], ["Allbirds", "Outdoor Voices", 2, 4, 50]);
});

// Fable tie ruling (Oct 14): a two-line call card from existing outputs, two labels, never fused into one claim.
test("callCard: the first call and where the seed's audience leads, as two separate lines", () => {
  const ab = stepsFrom(load("allbirds"));
  const decision = load("allbirds").findLast((e) => e.type === "decision") as Extract<AskEvent, { type: "decision" }>;
  const card = callCard(ab, decision.decision!)!;
  assert.equal(card.first, "First call: Bombas.");
  assert.equal(card.where, "Where Allbirds' audience leads: San Francisco, New York and Denver.");
  // never one recommendation: the call line names no place, the place line names no call
  for (const c of decision.decision!.calls) assert.ok(!card.where!.includes(c.name.replace(/\[\[|\]\]/g, "")));
  assert.ok(!/\b(in|for|test)\b/.test(card.first.replace("First call:", "")));
  const mjDecision = load("mt-joy").findLast((e) => e.type === "decision") as Extract<AskEvent, { type: "decision" }>;
  const mjCard = callCard(mj, mjDecision.decision!)!;
  assert.equal(mjCard.first, "First call: Outdoor Voices.");
  assert.equal(mjCard.where, null); // no split, so no market in any step: no line
});
