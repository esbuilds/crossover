import { test } from "node:test";
import assert from "node:assert/strict";
import { isHit, partnerRank, reverseLimit, reverseSentences } from "./replay-reverse.ts";
import reverse from "../audit/replay-reverse.json" with { type: "json" };

test("the partner's rank among the eight by the other direction; ties and 'not in top 50' go against it", () => {
  assert.equal(partnerRank([1, 9, 16, 31, 9, 12, 30, null], 0), 1); // Bombas fans rank Allbirds 1st
  assert.equal(partnerRank([9, 1, 9, 31, 2, 12, 30, null], 0), 4); // a tie at 9 puts the partner behind the other 9
  assert.equal(partnerRank([null, 1, 2, null, null, null, null, null], 0), 8); // not in top 50: last, whoever else is out
  assert.equal(partnerRank([null, null, null, null, null, null, null, null], 0), 8);
  assert.equal(isHit([3, 1, 2, 40, null, null, null, null], 0), true);
  assert.equal(isHit([3, 1, 2, 3, null, null, null, null], 0), false);
});

test("the /audit paragraph prints the reverse replay as it ran", () => {
  assert.deepEqual(reverseSentences(reverse), [
    `Reverse replay: each case's eight ranked the other way, by where each one's own fans put the seed, with ties and "not in their top 50" counted against the real partner. It fails its bar: the real partner came in the top three 5 times in 23 (needed 13), against 3 under the scrambled seeds; for the second test alone, 1 of 14 against 2.`,
    "Of the 12 lists that held the seed, 5 were the real partner's, a count made after the run, not a test.",
  ]);
  assert.equal(reverseLimit(reverse), "With take=50, the reverse direction can't be measured for most pairs: the seed was missing from 172 of the 184 fans' top 50 lists in this run.");
});
