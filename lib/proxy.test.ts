// Proxy weights, share-link parsing, and that proxies are excluded from their own slate. No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { weightsFor, parseProxies, formatProxies, parseTag } from "./proxy-params.ts";
import { proxyBody } from "./qloo.ts";

const A = "6647FB92-9390-4B58-885B-86D96FF5BB6D";
const B = "03E484EE-FAD4-41FB-9139-2A053C849654";
const C = "4DF7C265-52D9-4A99-8803-F62C2302D561";

test("proxies weigh 10, 7, then 5, at most five", () => {
  assert.deepEqual(weightsFor([A, B, C]), [
    { id: A, weight: 10 },
    { id: B, weight: 7 },
    { id: C, weight: 5 },
  ]);
  assert.equal(weightsFor(Array(8).fill(A)).length, 5);
});

test("share-link proxies round-trip and reject anything malformed", () => {
  const signals = weightsFor([A, B]);
  assert.deepEqual(parseProxies(formatProxies(signals)), signals);
  for (const bad of ["", "nope:10", `${A}:0`, `${A}:abc`, `${A}:10,${A}:5`, `${A}:10,${B}:5,${C}:5,${A.slice(0, -1)}1:5,${B.slice(0, -1)}1:5,${C.slice(0, -1)}1:5`])
    assert.equal(parseProxies(bad), null, bad);
});

test("proxy requests exclude every proxy from the results, plus any extra exclusions", () => {
  const body = proxyBody("urn:entity:brand", weightsFor([A, B]), { take: 10, "filter.exclude.entities": C });
  assert.equal(body["filter.exclude.entities"], `${A},${B},${C}`);
  assert.deepEqual(body["signal.interests.entities"], [
    { id: A, weight: 10 },
    { id: B, weight: 7 },
  ]);
});

test("category tags must look like Qloo tag ids", () => {
  assert.equal(parseTag("urn:tag:genre:brand:food_and_beverage:food:meat_seafood_and_substitutes"), "urn:tag:genre:brand:food_and_beverage:food:meat_seafood_and_substitutes");
  for (const bad of [null, "", "seafood", "urn:tag:Bad Tag", "urn:tag:x;drop"]) assert.equal(parseTag(bad), null, String(bad));
});
