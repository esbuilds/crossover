import test from "node:test";
import assert from "node:assert/strict";
import { validShareLink } from "./share-link.ts";
import { RESOLVE_TYPES } from "./qloo.ts";

const ID = "4DF7C265-52D9-4A99-8803-F62C2302D561";
const ID2 = "C445C761-CB38-4FEE-B085-D35F444A04DF";
test("share links: valid shapes pass, malformed ones fail, other paths are not share links", () => {
  const q = (s: string) => new URLSearchParams(s);
  assert.equal(validShareLink(`/s/${ID}`, q("t=urn:entity:brand&c=texas")), true);
  assert.equal(validShareLink("/s/not-a-real-id", q("t=urn:entity:brand")), false);
  assert.equal(validShareLink(`/s/${ID}`, q("")), false); // untyped
  assert.equal(validShareLink("/s/p", q("name=Graza")), null); // proxy links are checked by their own page
  assert.equal(validShareLink(`/pair/${ID}/${ID2}`, q("ta=urn:entity:brand&tb=urn:entity:artist")), true);
  assert.equal(validShareLink("/pair/x/y", q("")), false);
  assert.equal(validShareLink(`/pair/${ID}/${ID}`, q("ta=urn:entity:brand&tb=urn:entity:brand")), false);
  assert.equal(validShareLink("/", q("")), null);
  assert.equal(validShareLink(`/triage/${ID}`, q(`t=urn:entity:brand&n=${ID2}:artist`)), true);
  assert.equal(validShareLink(`/triage/${ID}`, q("t=urn:entity:brand&n=junk")), false);
  assert.equal(validShareLink("/triage", q("")), null); // the paste page itself
});
test("share-link types match the resolver's", () => {
  for (const t of RESOLVE_TYPES) assert.equal(validShareLink(`/s/${ID}`, new URLSearchParams(`t=${t}`)), true);
});

test("ask links: a Qloo id with a known or absent type passes, anything else is a 404 (FIX-F6)", () => {
  const q = (s: string) => new URLSearchParams(s);
  assert.equal(validShareLink(`/ask/${ID}`, q("t=urn:entity:artist")), true);
  assert.equal(validShareLink(`/ask/${ID}`, q("")), true); // untyped: the page reads it as a brand
  assert.equal(validShareLink(`/ask/${ID}/sheet`, q("t=urn:entity:brand")), true);
  assert.equal(validShareLink(`/ask/${ID}`, q("q=Allbirds")), true);
  assert.equal(validShareLink(`/ask/${ID}`, q("t=urn:entity:planet")), false);
  assert.equal(validShareLink("/ask/not-a-uuid", q("")), false);
  assert.equal(validShareLink("/ask/not-a-uuid/sheet", q("t=urn:entity:brand")), false);
  assert.equal(validShareLink(`/ask/${ID}/og`, q("t=urn:entity:brand")), null); // the share card route is not a page
});

test("category maps: only the prepared slugs pass", () => {
  const q = new URLSearchParams();
  assert.equal(validShareLink("/map/energy-drinks", q), true);
  assert.equal(validShareLink("/map/ENERGY-DRINKS", q), false);
  assert.equal(validShareLink("/map/nope", q), false);
  assert.equal(validShareLink("/map/%3Cscript%3E", q), false);
  assert.equal(validShareLink("/map/energy-drinks/og", q), null); // the share card route is not a page
});
