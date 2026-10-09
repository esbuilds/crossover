// Refine: constraint set shape, tag choice from a recorded /v2/tags shape, and unmappable constraints becoming notes.
// No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildConstraintSet, pickTag, refineParams, relaxedParams, appliedSentence } from "./refine.ts";

const tags = JSON.parse(readFileSync(new URL("../fixtures/tags-sample.json", import.meta.url), "utf8")).tags;
const BEER = { tag_id: "urn:tag:genre:brand:beer", name: "Beer", type: "urn:tag:genre:brand" };
const none = { include: [], exclude: [], region: null, domains: null, popularity_min: null, exclude_names: [], unmapped: [] };

test("pickTag takes the first tag whose parents include a wanted entity type", () => {
  assert.equal(pickTag(tags, ["brand"])?.tag_id, "urn:tag:genre:brand:food_and_beverage:food:meat_seafood_and_substitutes");
  assert.equal(pickTag(tags, ["place"])?.tag_id, "urn:tag:cuisine:qloo:tinned_fish");
  assert.equal(pickTag(tags, ["artist"]), null);
});

test("a full constraint set: tags, region, domains, chips, and the trace summary", () => {
  const c = buildConstraintSet(
    "no beer, Texas only, brands and artists only",
    {
      ...none,
      exclude: [{ phrase: "no beer", tag_query: "beer", applies_to: ["brand", "place"] }],
      region: { phrase: "Texas only", label: "Texas", states: ["tx"], location_query: "Texas" },
      domains: { phrase: "brands and artists only", domains: ["brand", "artist"] },
    },
    new Map([["beer|brand,place", BEER]]),
    new Map(),
  );
  assert.deepEqual(c.excludeTags, [{ ...BEER, domains: ["brand", "place"] }]);
  assert.deepEqual(c.states, ["TX"]);
  assert.equal(c.locationQuery, "Texas");
  assert.deepEqual(c.domains, ["brand", "artist"]);
  assert.deepEqual(c.applied.map((a) => a.label), ["No Beer", "Texas", "brands and artists only"]);
  assert.equal(c.summary, "Reading your constraints: excluding Beer; restricting to Texas; brands and artists only.");
  assert.deepEqual(c.notes, []);
  // per-domain params: places get the exclusion and location, films are skipped entirely
  assert.deepEqual(refineParams(c, "brand"), { "filter.exclude.tags": BEER.tag_id, "signal.location.query": "Texas" });
  assert.equal(refineParams(c, "movie"), null);
});

test("anything unmappable becomes a visible note, never a silent no-op", () => {
  const c = buildConstraintSet(
    "only brands founded by women, no beer, no Zzqx",
    {
      ...none,
      exclude: [{ phrase: "no beer", tag_query: "beer", applies_to: ["brand"] }],
      exclude_names: [{ phrase: "no Zzqx", name: "Zzqx" }],
      unmapped: [{ phrase: "only brands founded by women", why: "Qloo has no founder data" }],
    },
    new Map([["beer|brand", null]]), // the tag search found nothing
    new Map([["Zzqx", null]]), // the name didn't resolve
  );
  assert.equal(c.applied.length, 0);
  assert.equal(c.notes.length, 3);
  assert.match(c.notes.join(" "), /founded by women/);
  assert.match(c.notes.join(" "), /no matching tag for beer/);
  assert.match(c.notes.join(" "), /couldn't find Zzqx/);
  assert.equal(c.summary, "Reading your constraints: nothing here maps to a filter.");
});

test("an empty hard-filtered domain relaxes to a soft signal; only applied phrases reach the ranker", () => {
  const MUSIC = { tag_id: "urn:tag:audience:music", name: "Music Enthusiasts", type: "urn:tag:audience" };
  const c = buildConstraintSet(
    "brands that sponsor live music, founded by women",
    {
      ...none,
      include: [{ phrase: "brands that sponsor live music", tag_query: "live music", applies_to: ["brand"] }],
      unmapped: [{ phrase: "founded by women", why: "no founder data" }],
    },
    new Map([["live music|brand", MUSIC]]),
    new Map(),
  );
  assert.deepEqual(refineParams(c, "brand"), { "filter.tags": MUSIC.tag_id });
  assert.deepEqual(relaxedParams(c, "brand"), { "signal.interests.tags": MUSIC.tag_id });
  assert.equal(relaxedParams(c, "artist"), null); // nothing to relax where no include filter applies
  assert.equal(appliedSentence(c), "brands that sponsor live music"); // the unmapped phrase stays out
});
