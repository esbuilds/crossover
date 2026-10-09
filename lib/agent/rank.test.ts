// Ranking agent: output shape and judgment on a recorded real response, plus the id-mapping guard.
// The recorded response lives in fixtures/demo (gitignored); record it with scripts/record-rank.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { toRanking, type Ranking } from "./rank.ts";
import { DOMAINS, type Domain, type Pick, type Slate } from "../slate.ts";

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

test("toRanking rejects invented, cross-domain, and duplicate ids, and caps kept at five", () => {
  const pick = (id: string) => ({ entity_id: id, name: id, type: "", affinity: 0.9, popularity: 0.5, tags: [] });
  const refs = new Map<string, { domain: Domain; pick: Pick }>([
    ...[1, 2, 3, 4, 5, 6].map((i) => [`brand-${i}`, { domain: "brand" as const, pick: pick(`B${i}`) }] as const),
    ["artist-1", { domain: "artist" as const, pick: pick("A1") }] as const,
  ]);
  const ranking = toRanking(
    {
      domains: [
        {
          domain: "brand",
          kept: ["brand-1", "brand-9", "artist-1", "brand-1", "brand-2", "brand-3", "brand-4", "brand-5", "brand-6"].map((id) => ({ id, why: "w" })),
          dropped: [{ id: "brand-6", reason: "already kept" }],
        },
      ],
    },
    refs,
  );
  assert.deepEqual(ranking.brand.kept.map((k) => k.entity_id), ["B1", "B2", "B3", "B4", "B5"]);
  assert.equal(ranking.brand.dropped.length, 1); // brand-6 never made the capped kept list, so dropping it is allowed
  assert.equal(ranking.artist.kept.length, 0);
});
