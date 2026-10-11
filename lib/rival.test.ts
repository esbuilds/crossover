// rival-v2 pick rule and its copy, on fixture lists. No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRival } from "./rival.ts";
import { bannedIn, COMPETITOR_LABEL, methodLine } from "./vs.ts";
import type { Entity, FullTags } from "./qloo.ts";

const BRAND = "urn:entity:brand";
const DRINKS = "urn:tag:genre:brand:food_and_beverage:drinks", FOOD = "urn:tag:genre:brand:food_and_beverage:food", FASHION = "urn:tag:genre:brand:fashion:casual";
const SODA = { id: "urn:tag:product_category:qloo:soft_drinks", name: "Soft Drinks" }, BEV = { id: "urn:tag:product_category:qloo:beverages", name: "Beverages" };
const e = (name: string, affinity: number, genres: string[] = []): Entity =>
  ({ entity_id: name, name, types: [BRAND], popularity: 0.9, akas: [], affinity, tags: genres.map((t) => ({ tag_id: t, name: t, type: "urn:tag" })) }) as Entity;
const full = (rows: [string, Partial<FullTags>][]) => new Map(rows.map(([id, t]) => [id, { id, genres: [], categories: [], competitors: [], ...t }]));

const ld = e("Liquid Death", 1, [DRINKS]);
const ldFull = full([["Liquid Death", { genres: [DRINKS], competitors: ["Celsius", "Liquid Death", "Waterloo"] }]]);

test("genre: the highest-affinity brand sharing the second-level tag wins; two alternates; Qloo's competitor tags ride along", () => {
  const r = pickRival(ld, BRAND, [e("Fallen Footwear", 0.95, [FASHION]), e("Aqua Hydrate", 0.86, [DRINKS]), e("Death Wish Coffee", 0.87, [DRINKS]), e("Pedialyte", 0.8, [DRINKS])], ldFull);
  assert.equal(r.kind, "pick");
  if (r.kind !== "pick") return;
  assert.equal(r.field, "genre");
  assert.equal(r.pick.name, "Death Wish Coffee");
  assert.deepEqual(r.alternates.map((x) => x.name), ["Aqua Hydrate", "Pedialyte"]);
  assert.deepEqual(r.competitors, ["Celsius", "Waterloo"]); // the seed's own name never appears
});

test("sub-brands and the seed itself are never picked", () => {
  const r = pickRival(ld, BRAND, [ld, e("Liquid Death Mountain Water", 0.99, [DRINKS]), e("Aqua Hydrate", 0.86, [DRINKS])], ldFull);
  assert.equal(r.kind === "pick" && r.pick.name, "Aqua Hydrate");
});

test("no genre tag: the most specific shared Qloo product category, by affinity", () => {
  const olipop = e("Olipop", 1);
  const list = [e("LaCroix", 0.95), e("Poppi", 0.91), e("Amy's Kitchen", 0.97), e("Spindrift", 0.9)];
  const tags = full([
    ["Olipop", { categories: [BEV, SODA], competitors: ["Poppi", "Culture Pop"] }],
    ["LaCroix", { categories: [BEV] }],
    ["Poppi", { categories: [BEV, SODA] }],
    ["Spindrift", { categories: [BEV, SODA] }],
    ["Amy's Kitchen", { categories: [{ id: "urn:tag:product_category:qloo:frozen", name: "Frozen" }] }],
  ]);
  const r = pickRival(olipop, BRAND, list, tags);
  assert.equal(r.kind, "pick");
  if (r.kind !== "pick") return;
  assert.equal(r.field, "category");
  assert.equal(r.category, "soft drinks"); // two brands carry it, three carry beverages
  assert.equal(r.pick.name, "Poppi");
  assert.deepEqual(r.alternates.map((x) => x.name), ["Spindrift"]);
  assert.equal(methodLine("Olipop", r), "Closest brand by affinity in Olipop's top 50 sharing a Qloo product category (soft drinks): Poppi (0.91). Also close: Spindrift.");
});

test("no genre or category match: broader chips; nothing at all: none", () => {
  const r = pickRival(ld, BRAND, [e("Snack A", 0.9, [FOOD]), e("Snack B", 0.95, [FOOD]), e("Snack C", 0.8, [FOOD]), e("Shirt", 0.99, [FASHION])], ldFull);
  assert.equal(r.kind, "broader");
  if (r.kind === "broader") assert.deepEqual(r.options.map((x) => x.name), ["Snack B", "Snack A", "Snack C"]);
  assert.equal(pickRival(ld, BRAND, [e("Shirt", 0.99, [FASHION])], ldFull).kind, "none");
});

test("an artist, person or show seed gets its top three brands as chips, never an auto-run", () => {
  const r = pickRival(e("Mt. Joy", 1), "urn:entity:artist", [e("Outdoor Voices", 0.97), e("Faherty", 0.94), e("Mt. Joy Merch", 0.99), e("SeaVees", 0.92), e("Quince", 0.9)], new Map());
  assert.equal(r.kind, "brands");
  if (r.kind === "brands") assert.deepEqual(r.options.map((x) => x.name), ["Outdoor Voices", "Faherty", "SeaVees"]);
  assert.equal(methodLine("Mt. Joy", r), "Closest brands by affinity in Mt. Joy's list:");
});

test("copy rules: 'competitor' only inside Qloo's attribution; every other use is caught", () => {
  const pick = pickRival(ld, BRAND, [e("Death Wish Coffee", 0.87, [DRINKS])], ldFull);
  const lines = [methodLine("Liquid Death", pick), `${COMPETITOR_LABEL} Celsius, Waterloo`, methodLine("Liquid Death", { kind: "none", competitors: [] })];
  assert.deepEqual(bannedIn(lines.join(" "), ["Liquid Death", "Death Wish Coffee", "Celsius", "Waterloo"]), []);
  assert.deepEqual(bannedIn("Celsius is the main competitor. Our rival pick.", ["Celsius"]), ["rival", "competitor"]);
});
