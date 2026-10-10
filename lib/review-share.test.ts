import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShare, shareCard, shareQuery } from "./review-share.ts";

test("share: a prepared case round-trips; bad picks are dropped, never guessed", () => {
  const s = parseShare({ c: "mt-joy", p: "0,2,5", g: "1" })!;
  assert.deepEqual([s.caseKey, s.picks, s.gate], ["mt-joy", [0, 2, 5], true]);
  assert.deepEqual(parseShare(Object.fromEntries(new URLSearchParams(shareQuery(s)))), s);
  assert.deepEqual(parseShare({ c: "mt-joy", p: "0,9" })!.picks, []); // out of range
  assert.deepEqual(parseShare({ c: "mt-joy", p: "0,1,2,3" })!.picks, []); // more than three
  assert.equal(shareCard(s).line, "My picks: Allbirds, Patagonia, Red Bull. See what fans' taste says.");
});

test("share: your own list keeps its names; invalid links open the default", () => {
  const s = parseShare({ s: " Liquid Death ", n: ["Yeti", "Poppi", "Yeti"], p: "1" })!;
  assert.deepEqual([s.seed, s.names, s.picks, s.caseKey], ["Liquid Death", ["Yeti", "Poppi"], [1], null]);
  assert.equal(shareQuery(s), "s=Liquid+Death&n=Yeti&n=Poppi&p=1");
  assert.equal(parseShare({}), null);
  assert.equal(parseShare({ s: "x", n: Array.from({ length: 9 }, (_, i) => `n${i}`) }), null);
  assert.equal(parseShare({ c: "nope" }), null);
});

test("share: a picked name carries its id and round-trips; a malformed id rejects the link", () => {
  const id = "0C27D00E-DB6B-4F1D-B06A-AD3584131ECA";
  const s = parseShare({ s: "Liquid Death", n: [`Dr. Squatch::${id}::urn:entity:brand`, "Yeti"], p: "0" })!;
  assert.deepEqual(s.names, [{ name: "Dr. Squatch", id, type: "urn:entity:brand" }, "Yeti"]);
  const back = new URLSearchParams(shareQuery(s));
  assert.deepEqual(parseShare({ s: back.get("s")!, n: back.getAll("n"), p: back.get("p")! }), s);
  assert.equal(shareCard(s).line, "My picks: Dr. Squatch. See what fans' taste says.");
  assert.equal(parseShare({ s: "Liquid Death", n: ["Dr. Squatch::not-a-uuid::urn:entity:brand"] }), null);
  assert.equal(parseShare({ s: "Liquid Death", n: [`Dr. Squatch::${id}::javascript:alert(1)`] }), null);
});
