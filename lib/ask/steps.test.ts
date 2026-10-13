// The three step pictures on / (Pick A), shaped from an ask's recorded events. Fixtures are derived step outputs
// captured from the production cache (names, ids, two-decimal scores), not raw Qloo responses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cardsStep, mapStep, stepsFrom, twinsStep } from "./steps.ts";
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
