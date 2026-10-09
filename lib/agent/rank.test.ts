// Ranking agent: output shape and judgment on a recorded real response, plus the id-mapping guard.
// The recorded response lives in fixtures/demo (gitignored); record it with scripts/record-rank.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { toRanking, type Ranking } from "./rank.ts";
import { DOMAINS, type Pick, type Slate } from "../slate.ts";

const dir = new URL("../../fixtures/demo/", import.meta.url);
const recorded = existsSync(new URL("rank-liquid-death.json", dir));

test("Liquid Death ranking: shape, real picks only, Joe Rogan not kept", { skip: !recorded && "no recorded ranking" }, () => {
  const slate: Slate = JSON.parse(readFileSync(new URL("liquid-death.json", dir), "utf8")).slate;
  const { ranking }: { ranking: Ranking } = JSON.parse(readFileSync(new URL("rank-liquid-death.json", dir), "utf8"));
  for (const d of DOMAINS) {
    const ids = new Set(slate[d].map((p) => p.entity_id));
    const { kept, dropped } = ranking[d];
    assert.ok(kept.length <= 5, `${d}: ${kept.length} kept`);
    for (const k of kept) {
      assert.ok(ids.has(k.entity_id), `${d}: kept pick not in the slate`);
      assert.ok(k.why.split(/\s+/).length < 25, `${d}: why-line too long: ${k.why}`);
    }
    for (const x of dropped) assert.ok(ids.has(x.entity_id) && x.reason, `${d}: bad dropped entry`);
  }
  const podcasts = ranking.podcast.kept.map((k) => slate.podcast.find((p) => p.entity_id === k.entity_id)!.name);
  assert.ok(!podcasts.includes("The Joe Rogan Experience"), `kept podcasts: ${podcasts.join(", ")}`);
});

const pick = (id: string, affinity = 0.9): Pick => ({ entity_id: id, name: id, type: "", affinity, popularity: 0.5, tags: [] });
const brands = [1, 2, 3, 4, 5, 6, 7].map((i) => pick(`B${i}`, 1 - i / 100)); // affinity order
const d = (id: string, decision: "keep" | "demote" | "competitor" | "excluded" | "drop", reason = "", why = "w") => ({ id, decision, why, reason });

test("code owns the order: affinity order, the model can't promote", () => {
  // the model lists brand-7 first and keeps everything; the order still follows affinity
  const r = toRanking("brand", brands, [d("brand-7", "keep"), d("brand-1", "keep"), d("brand-3", "keep"), d("brand-2", "keep")]);
  assert.deepEqual(r.kept.map((k) => k.entity_id), ["B1", "B2", "B3", "B4", "B5"]);
});

test("demoted picks go after kept ones with their reason; drops leave the shortlist", () => {
  const r = toRanking("brand", brands, [d("brand-1", "demote", "generic retailer"), d("brand-2", "drop", "polarizing", "")]);
  assert.deepEqual(r.kept.map((k) => k.entity_id), ["B3", "B4", "B5", "B6", "B7"]);
  assert.deepEqual(r.demoted.map((k) => [k.entity_id, k.demoted]), [["B1", "generic retailer"]]); // kept its reason even past the cut
  assert.deepEqual(r.dropped, [{ entity_id: "B2", name: "B2", reason: "polarizing" }]);
});

test("competitors are demoted with a label, not dropped", () => {
  const r = toRanking("brand", brands.slice(0, 3), [d("brand-1", "competitor", "same shelf")]);
  assert.deepEqual(r.kept.map((k) => k.entity_id), ["B2", "B3"]);
  assert.deepEqual(r.demoted, [{ entity_id: "B1", why: "w", demoted: "same shelf", competitor: true }]);
  assert.equal(r.dropped.length, 0);
});

test("picks that break the user's constraints are demoted with the excluded label", () => {
  const r = toRanking("brand", brands.slice(0, 2), [d("brand-1", "excluded", "beer, and you said no alcohol")]);
  assert.deepEqual(r.kept.map((k) => k.entity_id), ["B2"]);
  assert.deepEqual(r.demoted, [{ entity_id: "B1", why: "w", demoted: "beer, and you said no alcohol", excluded: true }]);
});

test("unknown and duplicate ids are ignored, and a demote or drop without a reason counts as keep", () => {
  const r = toRanking("brand", brands.slice(0, 3), [d("brand-9", "drop", "x"), d("artist-1", "drop", "x"), d("brand-1", "drop", ""), d("brand-2", "drop", "dup"), d("brand-2", "keep")]);
  assert.deepEqual(r.kept.map((k) => k.entity_id), ["B1", "B3"]);
  assert.deepEqual(r.dropped.map((x) => x.entity_id), ["B2"]);
});
