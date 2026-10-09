import test from "node:test";
import assert from "node:assert/strict";
import { bucketFor, contrastPlay, formatNames, parseNames, sortRows } from "./triage.ts";

test("triage buckets: take, maybe, pass from the two ranks", () => {
  assert.equal(bucketFor(3, 26), "take"); // both in the top 50, one in the top 10 (Mt. Joy and Outdoor Voices)
  assert.equal(bucketFor(40, 9), "take");
  assert.equal(bucketFor(30, 40), "pass"); // both in the top 50 but neither in the top 10: not a take
  assert.equal(bucketFor(1, null), "maybe"); // exactly one side (Liquid Death and Dr. Squatch)
  assert.equal(bucketFor(null, 12), "maybe");
  assert.equal(bucketFor(null, null), "pass");
});

test("contrast play: only a pass, a partner above 0.9 popularity, at least one shared market", () => {
  assert.equal(contrastPlay("pass", 0.95, 2), true);
  assert.equal(contrastPlay("pass", 0.95, 0), false);
  assert.equal(contrastPlay("pass", 0.9, 3), false);
  assert.equal(contrastPlay("maybe", 0.99, 3), false);
});

test("rows sort by bucket, then by the seed's rank among the name's fans", () => {
  const rows = sortRows([
    { id: "p", bucket: "pass" as const, seedAmongName: null },
    { id: "m2", bucket: "maybe" as const, seedAmongName: null },
    { id: "t", bucket: "take" as const, seedAmongName: 30 },
    { id: "m1", bucket: "maybe" as const, seedAmongName: 12 },
  ]);
  assert.deepEqual(rows.map((r) => r.id), ["t", "m1", "m2", "p"]);
});

test("share-link names: valid ids and types parse, anything else is rejected", () => {
  const A = "4DF7C265-52D9-4A99-8803-F62C2302D561";
  const B = "C445C761-CB38-4FEE-B085-D35F444A04DF";
  assert.deepEqual(parseNames(`${A}:brand,${B}:artist`), [
    { id: A, type: "urn:entity:brand" },
    { id: B, type: "urn:entity:artist" },
  ]);
  assert.equal(formatNames(parseNames(`${A}:brand,${B}:artist`)!), `${A}:brand,${B}:artist`);
  assert.deepEqual(parseNames(`${A}:brand,${A}:brand`), [{ id: A, type: "urn:entity:brand" }]); // duplicates collapse
  assert.equal(parseNames(`${A}:place`), null);
  assert.equal(parseNames("nope:brand"), null);
  assert.equal(parseNames(Array.from({ length: 16 }, () => `${A}:brand`).join(",")), null); // over 15
  assert.equal(parseNames(""), null);
});
