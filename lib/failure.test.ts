import test from "node:test";
import assert from "node:assert/strict";
import { failCode } from "./failure.ts";
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
