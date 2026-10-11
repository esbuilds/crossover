// Rival finder pick rule and its copy, on fixture lists. No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRival } from "./rival.ts";
import { bannedIn, methodLine } from "./vs.ts";
import type { Entity } from "./qloo.ts";

const DRINKS = "urn:tag:genre:brand:food_and_beverage:drinks", FOOD = "urn:tag:genre:brand:food_and_beverage:food", FASHION = "urn:tag:genre:brand:fashion:casual";
const e = (name: string, affinity: number, tags: string[]): Entity =>
  ({ entity_id: name, name, types: ["urn:entity:brand"], popularity: 0.9, akas: [], affinity, tags: tags.map((t) => ({ tag_id: t, name: t, type: "urn:tag" })) }) as Entity;
const seed = e("Liquid Death", 1, [DRINKS]);

test("the highest-affinity brand sharing the second-level tag wins; two alternates follow", () => {
  const r = pickRival(seed, [e("Fallen Footwear", 0.95, [FASHION]), e("Aqua Hydrate", 0.86, [DRINKS]), e("Death Wish Coffee", 0.87, [DRINKS]), e("Pedialyte", 0.8, [DRINKS]), e("Celsius", 0.7, [DRINKS])]);
  assert.equal(r.kind, "pick");
  if (r.kind !== "pick") return;
  assert.equal(r.pick.name, "Death Wish Coffee");
  assert.equal(r.pick.affinity, 0.87);
  assert.deepEqual(r.alternates.map((x) => x.name), ["Aqua Hydrate", "Pedialyte"]);
});

test("sub-brands (the seed's name inside theirs) and the seed itself are never picked", () => {
  const r = pickRival(seed, [seed, e("Liquid Death Mountain Water", 0.99, [DRINKS]), e("Aqua Hydrate", 0.86, [DRINKS])]);
  assert.equal(r.kind === "pick" && r.pick.name, "Aqua Hydrate");
});

test("no second-level match falls back to the top three sharing the top level", () => {
  const r = pickRival(seed, [e("Snack A", 0.9, [FOOD]), e("Snack B", 0.95, [FOOD]), e("Snack C", 0.8, [FOOD]), e("Snack D", 0.7, [FOOD]), e("Shirt", 0.99, [FASHION])]);
  assert.equal(r.kind, "broader");
  if (r.kind === "broader") assert.deepEqual(r.options.map((x) => x.name), ["Snack B", "Snack A", "Snack C"]);
});

test("nothing in the field at all, or an artist seed with no brand genre: none", () => {
  assert.equal(pickRival(seed, [e("Shirt", 0.99, [FASHION])]).kind, "none");
  assert.equal(pickRival(e("Mt. Joy", 1, ["urn:tag:genre:artist:indie"]), [e("Shirt", 0.99, [FASHION])]).kind, "none");
});

test("method line says how the name was chosen, and passes the copy rules", () => {
  const pick = pickRival(seed, [e("Death Wish Coffee", 0.87, [DRINKS]), e("Aqua Hydrate", 0.86, [DRINKS]), e("Pedialyte", 0.8, [DRINKS])]);
  const line = methodLine("Liquid Death", pick);
  assert.equal(line, "Closest same-field brand by affinity in Liquid Death's top 50: Death Wish Coffee (0.87). Also close: Aqua Hydrate, Pedialyte.");
  const lines = [line, methodLine("Liquid Death", { kind: "broader", options: [] }), methodLine("Liquid Death", { kind: "none" })];
  assert.deepEqual(bannedIn(lines.join(" "), ["Liquid Death", "Death Wish Coffee", "Aqua Hydrate", "Pedialyte"]), []);
  assert.ok(!/rival|competitor/i.test(lines.join(" ")));
});
