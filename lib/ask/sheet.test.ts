// The call sheet (Pick 2, Oct 14): one page a partnerships lead forwards. Every number on it must come from a step the
// sheet cites, the replay line, or the blocked count; nothing is new model text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sheetModel } from "./sheet.ts";
import { stepsFrom } from "./steps.ts";
import type { AskEvent } from "./agent.ts";

const load = (name: string): AskEvent[] => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const PROOF = "Against real deals it never saw, the protocol put the real partner in the top three 6 of 9 times (v1) and 11 of 14 times (v2). Each is a frozen test; details on /audit.";

const numbersIn = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === "number") out.push(v.toFixed(2), String(v));
  else if (typeof v === "string") out.push(...(v.match(/(?<![\w.])\d+(?:\.\d+)?/g) ?? []));
  else if (Array.isArray(v)) v.forEach((x) => numbersIn(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => numbersIn(x, out));
  return out;
};

for (const name of ["allbirds", "mt-joy"]) {
  test(`${name}: the sheet carries the question, the calls, the doubles line, the limits, the proof and the blocked count`, () => {
    const events = load(name);
    const s = sheetModel(events, { proof: PROOF, blocked: 5 })!;
    assert.match(s.question, /^Who should .+ call first\?$/);
    assert.equal(s.calls.length, 3);
    assert.match(s.card.first, /^First call: /);
    assert.match(s.doubles, /^Overlap check: /);
    assert.ok(s.limits.length >= 3);
    assert.equal(s.proof, PROOF);
    assert.equal(s.blocked, "Blocked by the checker under its current rule: 5 answers, each listed on /audit with the rule that blocked it.");
    if (name === "allbirds") assert.deepEqual([s.map?.closerToSeed, s.map?.closerToRival, s.map?.withinGapOfBoth], [2, 4, 50]);
    else assert.equal(s.map, null);
  });

  test(`${name}: every number on the sheet comes from a step, the proof line or the blocked count`, () => {
    const events = load(name);
    const s = sheetModel(events, { proof: PROOF, blocked: 5 })!;
    const allowed = new Set([...numbersIn(stepsFrom(events).map((x) => x.output)), ...numbersIn(PROOF), "5", ...stepsFrom(events).map((x) => String(x.n))]);
    const shown = numbersIn([s.question, s.tiedNote, s.card.first, s.card.where, s.calls.map((c) => c.reason), s.doubles, s.notes.map((x) => x.text), s.footnotes.map((f) => [f.label, f.summary]), s.map && [s.map.closerToSeed, s.map.closerToRival, s.map.withinGapOfBoth]]);
    const strays = shown.filter((n) => !allowed.has(n) && !allowed.has(Number(n).toFixed(2)));
    assert.deepEqual(strays, []);
  });
}

test("an ask that isn't cached, or whose decision was blocked, has no sheet", () => {
  assert.equal(sheetModel([], { proof: PROOF, blocked: 5 }), null);
});
