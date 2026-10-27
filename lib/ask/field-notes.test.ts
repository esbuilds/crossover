// Field notes (Fable's checker sign-off, real Oct 15): from the same fields() the candidates cut uses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldNotes } from "./field-notes.ts";

const G = "urn:tag:genre:brand:";
const e = (name: string, tags: [string, string][]) => ({ entity_id: name, name, tags: tags.map(([id, n]) => ({ tag_id: G + id, name: n })) }) as never;

test("a seed with a specific tag: the cut names its field, and no shared line", () => {
  const dodgers = e("Los Angeles Dodgers", [["sports_organization", "Sports Organization"], ["sports_organization:baseball", "Baseball"]]);
  const raiders = e("Las Vegas Raiders", [["sports_organization", "Sports Organization"], ["sports_organization:football", "Football"]]);
  assert.deepEqual(fieldNotes(dodgers, [raiders], ["Las Vegas Raiders"]), { cut: "Own field left out: Baseball. Qloo's wider category, sports organization, was not.", shared: null });
});

test("a seed with only a broad tag: the shared line names the call and the tag; without one it still says the cut couldn't run", () => {
  const chipotle = e("Chipotle", [["dining", "Dining"]]);
  const top = [e("MOD Pizza", [["dining", "Dining"]]), e("Thomas' Breakfast", [["food_and_beverage", "Food & Beverage"]])];
  assert.deepEqual(fieldNotes(chipotle, top, ["F'real Milkshakes", "MOD Pizza", "Thomas' Breakfast"]), { cut: null, shared: "The same-field cut had no specific tag to run on for Chipotle; MOD Pizza shares its only Qloo tag, dining. The audit lists this limit." });
  // A-2 (real Oct 27): the answer card carries this line, so a seed whose cut couldn't run always has one
  assert.deepEqual(fieldNotes(chipotle, top, ["Thomas' Breakfast"]), { cut: null, shared: "The same-field cut had no specific tag to run on for Chipotle, so brands in its own field can be among the candidates. The audit lists this limit." });
});

// Gate (Fable's sign-off): the shared line never appears on the frozen asks. Allbirds' and Coca-Cola's genre tags as Qloo
// returns them (cached Oct 15) carry a specific field, so the cut ran and the shared branch can't fire. Mt. Joy is an
// artist and the Converse replay is the case path; fieldNotesFor returns null for both.
test("the frozen seeds carry a specific field, so no shared line", () => {
  const allbirds = e("Allbirds", [["fashion:footwear", "Footwear"], ["fashion", "Fashion"], ["fashion:footwear:sneaker:running", "Running"], ["fashion:casual", "Casual"], ["fashion:footwear:sneakers", "Sneakers"]]);
  const coke = e("Coca-Cola", [["food_and_beverage:drinks", "Drinks"], ["food_and_beverage", "Food & Beverage"], ["food_and_beverage:drinks:carbonated", "Carbonated"]]);
  const bombas = e("Bombas", [["fashion", "Fashion"], ["fashion:lingerie_and_sleepwear", "Lingerie"]]);
  assert.deepEqual(fieldNotes(allbirds, [bombas], ["Bombas"]), { cut: "Own field left out: Footwear and Casual. Qloo's wider category, fashion, was not.", shared: null });
  assert.equal(fieldNotes(coke, [], ["Converse"]).shared, null);
});
