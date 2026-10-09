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
