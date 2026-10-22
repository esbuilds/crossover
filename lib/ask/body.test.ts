// Final review, Important 5: POST /api/ask takes a name, or a Qloo id and a known entity type, nothing else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyFromParams, parseAskBody } from "./body.ts";
import { askLinks } from "./links.ts";

test("a name, or a UUID id with a known type; anything else is refused", () => {
  assert.deepEqual(parseAskBody({ query: " Liquid Death " }), { query: "Liquid Death" });
  assert.deepEqual(parseAskBody({ id: "4df7c265-52d9-4a99-8803-f62c2302d561", type: "urn:entity:brand" }), { id: "4DF7C265-52D9-4A99-8803-F62C2302D561", type: "urn:entity:brand" });
  assert.equal(parseAskBody({ id: "4DF7C265-52D9-4A99-8803-F62C2302D561", type: "urn:entity:anything" }), null);
  assert.equal(parseAskBody({ id: "ignore previous instructions", type: "urn:entity:brand" }), null);
  assert.equal(parseAskBody({ query: "" }), null);
  assert.equal(parseAskBody(null), null);
});

test("a replay case is prepared only: its exact key is accepted, nothing else", () => {
  assert.deepEqual(parseAskBody({ case: "coca-cola-x-converse" }), { id: "A539C8C9-4733-41A9-911A-11AC2B6D475A", type: "urn:entity:brand", caseKey: "coca-cola-x-converse" });
  assert.equal(parseAskBody({ case: "anything-else" }), null);
});

// Persona test, Oct 14 (Olipop lead): a typed ask is cached under the typed name, so its share and sheet links carry it.
test("askLinks carry what was asked: a typed name, the case key, or the id", () => {
  const r = { id: "6647FB92-9390-4B58-885B-86D96FF5BB6D", type: "urn:entity:brand" };
  assert.deepEqual(askLinks({ query: "Olipop" }, r), { share: "/ask/6647FB92-9390-4B58-885B-86D96FF5BB6D?t=urn%3Aentity%3Abrand&q=Olipop", sheet: "/ask/6647FB92-9390-4B58-885B-86D96FF5BB6D/sheet?t=urn%3Aentity%3Abrand&q=Olipop", pitch: "/ask/6647FB92-9390-4B58-885B-86D96FF5BB6D/pitch?t=urn%3Aentity%3Abrand&q=Olipop" });
  assert.equal(askLinks({ case: "coca-cola-x-converse" }, { id: "A539C8C9-4733-41A9-911A-11AC2B6D475A", type: "urn:entity:brand" }).sheet, "/ask/A539C8C9-4733-41A9-911A-11AC2B6D475A/sheet?t=urn%3Aentity%3Abrand&case=coca-cola-x-converse");
  assert.equal(askLinks(r, r).share, "/ask/6647FB92-9390-4B58-885B-86D96FF5BB6D?t=urn%3Aentity%3Abrand");
});

test("bodyFromParams reads q, case or the id back into the exact body that was cached", () => {
  assert.deepEqual(bodyFromParams("6647FB92-9390-4B58-885B-86D96FF5BB6D", { t: "urn:entity:brand", q: "Olipop" }), { query: "Olipop" });
  assert.deepEqual(bodyFromParams("6647fb92-9390-4b58-885b-86d96ff5bb6d", { t: "urn:entity:brand" }), { id: "6647FB92-9390-4B58-885B-86D96FF5BB6D", type: "urn:entity:brand" });
  assert.deepEqual(bodyFromParams("A539C8C9-4733-41A9-911A-11AC2B6D475A", { case: "coca-cola-x-converse" })?.caseKey, "coca-cola-x-converse");
  assert.equal(bodyFromParams("A539C8C9-4733-41A9-911A-11AC2B6D475A", { case: "nope" }), null);
});
