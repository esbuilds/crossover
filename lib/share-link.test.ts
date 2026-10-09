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
});
test("share-link types match the resolver's", () => {
  for (const t of RESOLVE_TYPES) assert.equal(validShareLink(`/s/${ID}`, new URLSearchParams(`t=${t}`)), true);
});
