// lib/review-run.test.ts
// The review runner the route and the ask agent share, on Mt. Joy's top four (scores Qloo returned Oct 13). No live API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Cold, runReview, twinsFor, warmFirst } from "./review-run.ts";
import { pairKey, type Identity, type Ref, type Scorer } from "./review.ts";

const B = "urn:entity:brand";
const ref = (name: string, type = B): Ref => ({ entity_id: name, name, type, popularity: 0.9, tags: [] });
const seed = ref("Mt. Joy", "urn:entity:artist");
const FWD: Record<string, number> = { Allbirds: 0.95, REI: 0.907, Patagonia: 0.906, "Hydro Flask": 0.903, Airbnb: 0.775, Spotify: 0.621 };
const PAIRS: Record<string, number> = { "Allbirds|REI": 0.866, "Allbirds|Patagonia": 0.856, "Allbirds|Hydro Flask": 0.816, "Patagonia|REI": 0.971, "Hydro Flask|REI": 0.889, "Hydro Flask|Patagonia": 0.894 };
const score: Scorer = async (p) => {
  const ids = String(p["filter.results.entities"]).split(",");
  const signal = String(p["signal.interests.entities"]);
  if (signal === "Mt. Joy") return ids.map((id) => ({ entity_id: id, affinity: FWD[id] }));
  if (ids.length === 1 && ids[0] === "Mt. Joy") return [{ entity_id: "Mt. Joy", affinity: 0.8 }]; // reverse, across types
  return ids.map((id) => ({ entity_id: id, affinity: PAIRS[pairKey(signal, id)] }));
};
const kept: Identity[] = Object.keys(FWD).map((n) => ({ state: "confirmed", input: n, entity: ref(n), via: "chosen id" }));

test("runReview: no clear three for Mt. Joy's four, twins REI and Patagonia, ranks peeked never fetched", async () => {
  const r = await runReview(seed, kept, {}, { score, peek: async () => null });
  const g = r.groups[0];
  assert.equal(g.selection.noClearThree, true);
  assert.deepEqual(r.twins[B], { a: "REI", b: "Patagonia", value: 0.971, next: 0.894 });
  assert.deepEqual(r.ranks.REI, { amongSeedFans: undefined, seedAmongTheirs: undefined });
});

test("runReview withTwins false leaves twins empty; twinsFor computes them on demand", async () => {
  const r = await runReview(seed, kept, {}, { score, peek: async () => null, withTwins: false });
  assert.deepEqual(r.twins, {});
  assert.deepEqual(await twinsFor(r.groups[0], score), { a: "REI", b: "Patagonia", value: 0.971, next: 0.894 });
});

// Review round 4 (Oct 13): a cold review (a list nobody has run, like "pick from these eight") counts against the
// visitor's cold cap like a pair; a warm one never does.
test("warmFirst: a warm run never spends; a cold one spends once, then runs live", async () => {
  let spent = 0;
  const spend = async () => void spent++;
  assert.equal(await warmFirst(async () => "warm", spend), "warm");
  assert.equal(spent, 0);
  const r = await warmFirst(async (mode) => { if (mode === "peek") throw new Cold(); return "live"; }, spend);
  assert.deepEqual([r, spent], ["live", 1]);
  await assert.rejects(warmFirst(async (mode) => { if (mode === "peek") throw new Cold(); return "live"; }, async () => { throw new Error("cap"); }), /cap/);
});
