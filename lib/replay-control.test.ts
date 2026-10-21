import { test } from "node:test";
import assert from "node:assert/strict";
import { controlSentences } from "./replay-control.ts";
import control from "../audit/replay-control.json" with { type: "json" };
import draw from "../audit/replay-control-draw.json" with { type: "json" };

test("the control ran on the drawn seeds, none its own", () => {
  assert.equal(control.cases.length, 23);
  control.cases.forEach((r, i) => {
    assert.equal(r.case, draw.cases[i].case);
    assert.equal(r.scrambledSeed, draw.cases[i].scrambledSeed);
    assert.notEqual(draw.cases[i].scrambledSeed, draw.cases[i].seed);
  });
  assert.equal(control.summary.scrambledHits, control.cases.filter((r) => r.hit).length);
});

test("the /audit paragraph prints the run as it came out", () => {
  assert.deepEqual(controlSentences(control), [
    "Scrambled seeds: each case's frozen eight scored again under a different case's seed, drawn by rule before any call. It fails its bar: the real partner landed in the top three 17 times in 23 under the wrong seed's fans, against 17 under its own (the bar was 12 or fewer).",
    "For the second test alone, 10 of 14 against 11. The mean rank went from 2.39 to 2.70; the right seed moved the real partner up 7 places in total across the 23.",
    "As the protocol said before the run, that means the eights favor the real partner whoever is asking: most of the replay's hits come from how the lists were built, not from the seed's fans.",
  ]);
});
