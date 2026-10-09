// Playbook lookup per seed type, with brand as the default. No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { playbookFor } from "./playbook.ts";

test("each seed type gets its own playbook", () => {
  assert.equal(playbookFor("urn:entity:artist").briefTitle, "Tour partner brief");
  assert.equal(playbookFor("urn:entity:artist").launchHeading, "Tour stop plan");
  assert.equal(playbookFor("urn:entity:artist").outreachFrom, "the artist's management");
  assert.equal(playbookFor("urn:entity:tv_show").briefTitle, "Licensing partner brief");
  assert.equal(playbookFor("urn:entity:movie").kind, "movie");
  assert.equal(playbookFor("urn:entity:person").launchHeading, "Appearance plan");
  assert.equal(playbookFor("artist").kind, "artist"); // bare kinds work too
});

test("brands, proxy seeds, and anything unknown default to the brand playbook", () => {
  for (const t of ["urn:entity:brand", "proxy", "urn:entity:place", "", undefined]) {
    const p = playbookFor(t);
    assert.equal(p.kind, "brand", String(t));
    assert.equal(p.launchHeading, "Launch plan");
  }
});
