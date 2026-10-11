// The /vs page's states, verdict line and copy rules, from fixture payloads. No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bannedIn, DOESNT_ESTABLISH, emptyColumn, mapLine, rankContext, verdict, vsState } from "./vs.ts";
import { validShareLink } from "./share-link.ts";
import type { Rivals, RivalRow } from "./rivals.ts";

const row = (id: string, lean: RivalRow["lean"], rankA: number | null = null, rankB: number | null = null): RivalRow => ({ id, name: id, kind: [], a: 0.8, b: 0.7, lean, rankA, rankB });
const rows = (k: number, lean: RivalRow["lean"]) => Array.from({ length: k }, (_, i) => row(`${lean}${i}`, lean));
const seed = (name: string) => ({ entity_id: name, name, type: "urn:entity:brand", kind: [] });
const payload = (a: number, b: number, shared: number, same = 0, none = 0): Rivals => ({
  version: "rivals-v1", a: seed("Liquid Death"), b: seed("Celsius"),
  leansA: rows(a, "a"), leansB: rows(b, "b"), shared: rows(shared, "shared"), sameField: rows(same, "a"), noData: rows(none, "no data"),
  layout: shared < 3 ? "two" : "three",
});

test("two lists: under three shared, the barely-overlap line with the shared count", () => {
  const r = payload(46, 50, 2, 2);
  assert.equal(vsState(r), "two lists");
  assert.equal(verdict(r)[1], "These two audiences barely overlap: 2 of 100 candidates sit within 0.05 of both.");
});

test("shared-heavy: mostly shared and one thin side, counted outside the same field", () => {
  const r = payload(1, 25, 33, 24); // Dodgers vs Yankees
  assert.equal(vsState(r), "shared-heavy");
  assert.match(verdict(r)[1], /^These two read as one audience: 33 of 59 candidates outside their own field/);
});

test("split: both sides hold three or more", () => {
  const r = payload(26, 33, 37); // Mt. Joy vs Noah Kahan
  assert.equal(vsState(r), "split");
  assert.equal(verdict(r).length, 1);
});

test("the verdict's counts are the payload's counts", () => {
  const r = payload(1, 25, 33, 24, 2);
  assert.equal(verdict(r)[0], "Of 85 candidates, 1 sits closer to Liquid Death, 25 closer to Celsius and 33 within 0.05 of both. 24 brands in their own field are set aside below; 2 had no data.");
});

test("rank context names both lists", () => {
  assert.equal(rankContext(row("x", "a", 3, null), "Liquid Death", "Celsius"), "#3 in Liquid Death's list, not in Celsius's top 50");
  assert.equal(rankContext(row("x", "b", null, 7), "Liquid Death", "Celsius"), "#7 in Celsius's list, not in Liquid Death's top 50");
  assert.equal(rankContext(row("x", "shared", 9, 20), "Liquid Death", "Celsius"), "#9 in Liquid Death's list, #20 in Celsius's list");
});

test("banned words: caught in our words, ignored inside entity names", () => {
  assert.deepEqual(bannedIn("Celsius fans love this; it steals share from women", []), ["steal", "fans love", "women"]);
  assert.deepEqual(bannedIn("Pretty Girls Sweat sits closer to Celsius", ["Pretty Girls Sweat"]), []);
  assert.deepEqual(bannedIn("5 brands in their own field are set aside", []), []);
  assert.deepEqual(bannedIn("gap 0.36, 12%", []), ["%"]);
});

test("the page's fixed copy passes its own rules", () => {
  const r = payload(1, 25, 33, 24, 2);
  assert.deepEqual(bannedIn([...DOESNT_ESTABLISH, ...verdict(r), emptyColumn("Arsenal")].join(" "), ["Liquid Death", "Celsius", "Arsenal"]), []);
});

test("/vs links: two different ids with types, else a real 404", () => {
  const id1 = "4DF7C265-52D9-4A99-8803-F62C2302D561", id2 = "D64DC967-F529-4A3F-9F89-774CE5118EF4";
  const q = new URLSearchParams({ ta: "urn:entity:brand", tb: "urn:entity:brand" });
  assert.equal(validShareLink(`/vs/${id1}/${id2}`, q), true);
  assert.equal(validShareLink(`/vs/${id1}/${id1}`, q), false);
  assert.equal(validShareLink(`/vs/${id1}/not-an-id`, q), false);
  assert.equal(validShareLink(`/vs/${id1}/${id2}`, new URLSearchParams({ ta: "urn:entity:brand" })), false);
});

const metros = (...names: string[]) => names.map((name) => ({ name }));
test("map sentence: metros in one side's top five and not the other's, up to three each", () => {
  const m = { metrosA: metros("Los Angeles", "San Diego", "Denver", "Portland", "Austin"), metrosB: metros("Miami", "Tampa", "San Diego", "Dallas", "Los Angeles") } as never;
  assert.equal(mapLine("Liquid Death", "Celsius", m), "Liquid Death leads in Denver, Portland and Austin; Celsius in Miami, Tampa and Dallas.");
});

test("map sentence: one side's markets all inside the other's, identical top fives, and no map", () => {
  const sub = { metrosA: metros("Boston", "Denver"), metrosB: metros("Boston", "Denver", "Minneapolis") } as never;
  assert.equal(mapLine("Mt. Joy", "Noah Kahan", sub), "Noah Kahan leads in Minneapolis; Mt. Joy's top five markets are all in Noah Kahan's.");
  assert.equal(mapLine("A", "B", { metrosA: metros("X"), metrosB: metros("X") } as never), "A and B share the same top five markets.");
  assert.equal(mapLine("A", "B", null), null);
});
