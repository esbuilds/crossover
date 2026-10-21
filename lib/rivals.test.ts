// Rivals lean and missing rules on a one-pair fixture (values shaped like Dodgers vs Yankees, VERIFY-4). No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareLists } from "./rivals.ts";
import type { Entity } from "./qloo.ts";

const MLB = "urn:tag:genre:brand:sports_organization:baseball:mlb";
const FASHION = "urn:tag:genre:brand:fashion:casual";
const e = (id: string, tags: string[] = [FASHION]): Entity =>
  ({ entity_id: id, name: id, types: ["urn:entity:brand"], popularity: 0.9, akas: [], tags: tags.map((t) => ({ tag_id: t, name: t, type: "urn:tag" })) }) as Entity;

const dodgers = e("Dodgers", [MLB]), yankees = e("Yankees", [MLB]);
// A's list carries Yankees itself (a seed, never a candidate) and Giants (same field)
const listA = [e("Giants", [MLB]), e("Faherty"), yankees, e("Stance"), e("Tie")];
const listB = [e("Mitchell & Ness"), e("Stance"), e("Floor"), e("Echo")];
const scoresA = [
  { entity_id: "Giants", affinity: 0.953 }, { entity_id: "Faherty", affinity: 0.9 }, { entity_id: "Stance", affinity: 0.826 },
  { entity_id: "Tie", affinity: 0.85 }, { entity_id: "Mitchell & Ness", affinity: 0.804 }, { entity_id: "Floor", affinity: 0.7649962877984056 },
  { entity_id: "Echo", affinity: 0.7 },
];
const scoresB = [
  { entity_id: "Giants", affinity: 0.882 }, { entity_id: "Faherty", affinity: 0.84 }, { entity_id: "Stance", affinity: 0.925 },
  { entity_id: "Tie", affinity: 0.8 }, { entity_id: "Mitchell & Ness", affinity: 0.928 }, { entity_id: "Floor", affinity: 0.8 },
  { entity_id: "Echo", affinity: 0.7 },
];
const r = compareLists(dodgers, yankees, listA, listB, scoresA, scoresB);
const ids = (rows: { id: string }[]) => rows.map((x) => x.id);

test("a gap of 0.05 or more leans; the larger gap comes first", () => {
  assert.deepEqual(ids(r.leansA), ["Faherty", "Tie"]); // 0.06, then exactly 0.05
  assert.deepEqual(ids(r.leansB), ["Mitchell & Ness", "Stance"]);
});

test("the seeds' own field leaves the columns", () => assert.deepEqual(ids(r.sameField), ["Giants"]));

test("floors and values repeated across both seeds are no data, never ranked", () => {
  assert.deepEqual(ids(r.noData).sort(), ["Echo", "Floor"]);
  assert.ok(r.noData.every((x) => x.lean === "no data"));
});

test("a seed is never a candidate, and ranks come from each list", () => {
  assert.ok(![...r.leansA, ...r.leansB, ...r.shared, ...r.sameField, ...r.noData].some((x) => x.id === "Yankees"));
  const stance = r.leansB.find((x) => x.id === "Stance")!;
  assert.deepEqual([stance.rankA, stance.rankB], [4, 2]);
});

test("under three shared, the layout is two lists", () => {
  assert.equal(r.shared.length, 0);
  assert.equal(r.layout, "two");
});

test("a seed's own sub-brand is set aside with the same field", () => {
  const ntc = e("Nike Training Club", ["urn:tag:genre:brand:app:fitness"]), nikesh = e("Nikesh", ["urn:tag:genre:brand:app:fitness"]);
  const o = compareLists(e("Nike", [MLB]), yankees, [ntc, nikesh], [], [{ entity_id: ntc.entity_id, affinity: 0.94 }, { entity_id: nikesh.entity_id, affinity: 0.9 }], [{ entity_id: ntc.entity_id, affinity: 0.93 }, { entity_id: nikesh.entity_id, affinity: 0.88 }]);
  assert.deepEqual(ids(o.sameField), ["Nike Training Club"]);
  assert.deepEqual(ids(o.shared), ["Nikesh"]);
});

// Copy rule: the payload carries Qloo data only (entity names, ids, types, category tag names) and fixed enums. No
// generated text, so no audience label.
test("no free text in the payload", () => {
  const allowed = new Set(["rivals-v1", "a", "b", "shared", "no data", "two", "three", "urn:entity:brand", MLB, FASHION, ...[...listA, ...listB, dodgers].map((x) => x.name)]);
  const strings: string[] = [];
  JSON.stringify(r, (_k, v) => (typeof v === "string" && strings.push(v), v));
  assert.deepEqual(strings.filter((s) => !allowed.has(s)), []);
});
