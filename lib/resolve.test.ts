// Match validation against recorded /search fixtures for the 20 probe brands. No live API, no LLM.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "./resolve.ts";
import type { Entity } from "./qloo.ts";

const fixtures: Record<string, Omit<Entity, "akas" | "tags">[]> = JSON.parse(
  readFileSync(new URL("../fixtures/search.json", import.meta.url), "utf8"),
);
const candidates = (q: string): Entity[] => fixtures[q].map((e) => ({ ...e, akas: [], tags: [] }));

const UNKNOWN = [
  "Pistakio", "Jesse & Ben's", "Aware Hair", "Girl Meets Dirt", "Fruition Chocolate Works",
  "Little Latke", "Floura", "Shuug", "Bawi", "Honey Department", "Fly By Jing", "Fishwife", "Graza", "Omsom",
];
const KNOWN: Record<string, string> = {
  Ghia: "Ghia", Olipop: "Olipop", "Liquid Death": "Liquid Death", Starbucks: "Starbucks", Pepsi: "Pepsi", Nike: "Nike",
};

for (const q of UNKNOWN) {
  test(`${q}: not found or ambiguous`, async () => {
    const r = await resolve(q, candidates(q), null); // null judge: the Haiku band stays ambiguous
    assert.notEqual(r.status, "confident", r.status === "confident" ? `wrongly matched ${r.match.name}` : "");
  });
}

for (const [q, name] of Object.entries(KNOWN)) {
  test(`${q}: confident brand`, async () => {
    const r = await resolve(q, candidates(q), null);
    assert.equal(r.status, "confident");
    if (r.status !== "confident") return;
    assert.equal(r.match.name, name);
    assert.ok(r.match.types.includes("urn:entity:brand"), `matched a ${r.match.types} instead of the brand`);
  });
}

// Oct 25: a person and an artist with the exact same name resolve to the artist, whichever Qloo lists first.
for (const [q, id] of [
  ["Taylor Swift", "4BBEF799-A0C4-4110-AB01-39216993C312"], // person listed first, separate artist entity
  ["Metallica", "C445C761-CB38-4FEE-B085-D35F444A04DF"], // artist listed first
]) {
  test(`${q}: confident artist, not the person`, async () => {
    const r = await resolve(q, candidates(q), null);
    assert.equal(r.status, "confident");
    if (r.status !== "confident") return;
    assert.equal(r.match.entity_id, id);
    assert.ok(r.match.types.includes("urn:entity:artist"));
  });
}

// Oct 9 (real): "Stanley" exactly names the drinkware brand and an artist, and Stan Lee carries it as an alias. The
// exact primary names win over the alias. Since Oct 11 (the cross-type rule) a brand and an artist sharing the exact
// name ask which one, brand first in Qloo's order; the alias-only person is never offered.
test("Stanley: asks brand or artist, never Stan Lee", async () => {
  const fx = candidates("Stanley").map((c) => (c.name === "Stan Lee" ? { ...c, akas: ["Stanley"] } : c)); // the alias the live data carries
  const r = await resolve("Stanley", fx, null);
  assert.equal(r.status, "ambiguous");
  if (r.status !== "ambiguous") return;
  assert.ok(r.candidates[0].types.includes("urn:entity:brand"));
  assert.ok(r.candidates.some((c) => c.types.includes("urn:entity:artist")));
  assert.ok(!r.candidates.some((c) => c.name === "Stan Lee"));
});

// Oct 11 gate: a rival of another type counts only on its primary name. "Metallica Through the Never" carries the
// alias "Metallica" and must not make the band ask.
test("Metallica: an alias-only movie is no rival", async () => {
  const e = (name: string, type: string, akas: string[] = []): Entity =>
    ({ id: name, name, types: [`urn:entity:${type}`], popularity: 0.9, akas, tags: [] }) as unknown as Entity;
  const r = await resolve("Metallica", [e("Metallica", "artist"), e("Metallica Through the Never", "movie", ["Metallica"])], null);
  assert.equal(r.status, "confident");
});

// Qloo content stays out of the repo: a recorded candidate carries identifiers plus the one number the resolver's
// rules read. popularity is pending a planner ruling (real Oct 12): without it 9 of these tests can't run.
const FIXTURE_KEYS = new Set(["name", "entity_id", "types", "popularity"]);
test("fixtures/search.json carries no Qloo content beyond the allowed keys", () => {
  for (const [q, hits] of Object.entries(fixtures)) for (const h of hits) for (const k of Object.keys(h)) assert.ok(FIXTURE_KEYS.has(k), `${q}: ${k}`);
});
