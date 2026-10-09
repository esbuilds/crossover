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
