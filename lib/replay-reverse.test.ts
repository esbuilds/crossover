import { test } from "node:test";
import assert from "node:assert/strict";
import { isHit, partnerRank } from "./replay-reverse.ts";

test("the partner's rank among the eight by the other direction; ties and 'not in top 50' go against it", () => {
  assert.equal(partnerRank([1, 9, 16, 31, 9, 12, 30, null], 0), 1); // Bombas fans rank Allbirds 1st
  assert.equal(partnerRank([9, 1, 9, 31, 2, 12, 30, null], 0), 4); // a tie at 9 puts the partner behind the other 9
  assert.equal(partnerRank([null, 1, 2, null, null, null, null, null], 0), 8); // not in top 50: last, whoever else is out
  assert.equal(partnerRank([null, null, null, null, null, null, null, null], 0), 8);
  assert.equal(isHit([3, 1, 2, 40, null, null, null, null], 0), true);
  assert.equal(isHit([3, 1, 2, 3, null, null, null, null], 0), false);
});
