import test from "node:test";
import assert from "node:assert/strict";
import { askErrorCopy, failCode } from "./failure.ts";
import { ColdPairCap } from "./rivals.ts";
import { CapReached } from "./agent/stream-cache.ts";
import { QuotaError } from "./qloo.ts";

test("calm failures: credit and daily cap are recognized, other errors are not", () => {
  const credit = Object.assign(new Error("Bad Request"), { responseBody: '{"error":{"message":"Your credit balance is too low to access the Anthropic API."}}' });
  assert.equal(failCode(credit), "credit");
  assert.equal(failCode(new QuotaError("daily cap of 600 Qloo calls reached")), "cap");
  assert.equal(failCode(new QuotaError("Qloo 429 /v2/insights")), null); // Qloo busy is a different, retryable message
  assert.equal(failCode(new Error("boom")), null);
  assert.equal(failCode(null), null);
});

// Outage drill (Oct 15): a Qloo 5xx after its one retry gets calm copy; a 4xx or anything else keeps its own message.
test("failCode: a Qloo 5xx is 'qloo'; a Qloo 400 isn't", () => {
  assert.equal(failCode(new Error("Qloo 503 /v2/insights: forced")), "qloo");
  assert.equal(failCode(new Error("Qloo 400 /v2/insights: bad param")), null);
});

// The ask route's error line (real Oct 27): the ten-cold-pairs-per-visitor cap read "Qloo's taste data is busy... try
// again in a minute", which fails again a minute later. A judge who clicks around the cached rows spends the ten.
test("ask errors: the per-visitor cold-pair cap says what it is, and busy stays for Qloo's quota", () => {
  assert.equal(askErrorCopy(new ColdPairCap()), "That's the ten new names and pairs Crossover runs for one visitor in a day. Names already asked still work, and the count resets at midnight UTC.");
  assert.match(askErrorCopy(new QuotaError("Qloo rate limit")), /busy right now/);
  assert.match(askErrorCopy(new CapReached()), /today's limit of 20 new asks/);
  assert.match(askErrorCopy(new Error("boom")), /stopped partway/);
});
