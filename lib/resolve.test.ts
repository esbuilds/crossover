// Match validation against the /search table for the probe brands (fixtures/search.json: our queries, every other word
// of Qloo's results invented by scripts/demo-search.ts, so the token comparisons hold). No live API, no LLM.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "./resolve.ts";
import { standInPopularity, type Recorded } from "./fixture-facts.ts";
import type { Entity } from "./qloo.ts";

const fixtures: Record<string, Recorded[]> = JSON.parse(
  readFileSync(new URL("../fixtures/search.json", import.meta.url), "utf8"),
);
const candidates = (q: string): Entity[] => fixtures[q].map((r) => ({ name: r.name, entity_id: r.entity_id, types: r.types, popularity: standInPopularity(r), akas: [], tags: [] }));

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

// a person and an artist with the exact same name resolve to the artist, whichever Qloo lists first.
for (const [q, id] of [
  ["Taylor Swift", "7A591B34-D42B-4A28-9BB9-0B9F128E4449"], // person listed first, separate artist entity
  ["Metallica", "67DE5A14-0870-4282-9189-45DDFED7F220"], // artist listed first
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
const STAN_LEE = fixtures.Stanley[0].name; // the alias-only person, renamed in the table
test("Stanley: asks brand or artist, never the alias-only person", async () => {
  const fx = candidates("Stanley").map((c) => (c.name === STAN_LEE ? { ...c, akas: ["Stanley"] } : c)); // the alias the live data carries
  const r = await resolve("Stanley", fx, null);
  assert.equal(r.status, "ambiguous");
  if (r.status !== "ambiguous") return;
  assert.ok(r.candidates[0].types.includes("urn:entity:brand"));
  assert.ok(r.candidates.some((c) => c.types.includes("urn:entity:artist")));
  assert.ok(!r.candidates.some((c) => c.name === STAN_LEE));
});

// Oct 11 gate: a rival of another type counts only on its primary name. "Metallica Through the Never" carries the
// alias "Metallica" and must not make the band ask.
test("Metallica: an alias-only movie is no rival", async () => {
  const e = (name: string, type: string, akas: string[] = []): Entity =>
    ({ id: name, name, types: [`urn:entity:${type}`], popularity: 0.9, akas, tags: [] }) as unknown as Entity;
  const r = await resolve("Metallica", [e("Metallica", "artist"), e("Metallica Through the Never", "movie", ["Metallica"])], null);
  assert.equal(r.status, "confident");
});

// Qloo content stays out of the repo: identifiers plus two facts our code derives (lib/fixture-facts.ts).
const FIXTURE_KEYS = new Set(["name", "entity_id", "types", "belowFloor", "winsPersonArtistTie"]);
test("fixtures/search.json carries no Qloo content beyond the allowed keys", () => {
  for (const [q, hits] of Object.entries(fixtures)) for (const h of hits) for (const k of Object.keys(h)) assert.ok(FIXTURE_KEYS.has(k), `${q}: ${k}`);
});

// The tiebreak margin on synthetic numbers (the recorded fixtures only carry who won): the more popular of a
// person/artist exact-name pair wins, and within 0.1 the artist.
test("person/artist tie: more popular wins, the artist within 0.1", async () => {
  const e = (type: string, popularity: number) => ({ name: "Cedric the Entertainer", entity_id: type, types: [`urn:entity:${type}`], popularity, akas: [], tags: [] }) as Entity;
  const pick = async (p: number, a: number) => {
    const r = await resolve("Cedric the Entertainer", [e("person", p), e("artist", a)], null);
    return r.status === "confident" ? r.match.entity_id : r.status;
  };
  assert.equal(await pick(0.94, 0.37), "person");
  assert.equal(await pick(0.95, 0.9), "artist");
  assert.equal(await pick(0.5, 0.94), "artist");
});
