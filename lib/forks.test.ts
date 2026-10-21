import { test } from "node:test";
import assert from "node:assert/strict";
import { forksSentences } from "./forks.ts";
import forks from "../audit/forks.json" with { type: "json" };
import look from "../audit/second-look.json" with { type: "json" };

test("the counts sentence reads audit/forks.json; the second look's only once Gate C has run", () => {
  const [first, ...rest] = forksSentences(forks.counts, null);
  assert.equal(first, "Across 39 cached asks the tools refused a call 0 times, the candidate list widened 4 times, and 3 stopped at the name. In 34 of the 36 that reached a decision, the first measurement tied (no clear three), and the agent named its calls anyway in 34 of them.");
  assert.equal(rest.length, 0);
  const g = { seeds: 16, checked: 15, need: 14, kept: 3, changed: 10, declined: 2, blocked: 1, measured: 14, checkFed: 5, citedLess: 1, pass: true };
  assert.match(forksSentences(forks.counts, g)[1], /did in 14, then kept the calls in 3, changed them in 10 and declined in 2; 1 failed the checker\..*It passes its bar: 15 of 16 checked, needed 14\.$/);
});

test("Gate C as run: 16 of 16 checked, and all 7 answers the checker sent back passed by citing less", () => {
  assert.equal(forksSentences(forks.counts, look.gateC.summary)[1], "The second look, run on the 16 names with a current answer, reads that tie and may measure the other direction: it did in 11, then kept the calls in 3, changed them in 11 and declined in 2; 0 failed the checker. The checker sent 7 answers back once, and 7 passed the second time only by citing less. It passes its bar: 16 of 16 checked, needed 14.");
});
