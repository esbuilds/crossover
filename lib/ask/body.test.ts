// Final review, Important 5: POST /api/ask takes a name, or a Qloo id and a known entity type, nothing else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAskBody } from "./body.ts";

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
