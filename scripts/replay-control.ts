// Replay control, scrambled seeds (audit/replay-control-protocol.md). A fork of scripts/replay-score.ts: the frozen
// eights scored under the drawn seed instead of their own. 23 Qloo calls; writes audit/replay-control.json only.
//   node --env-file=.env.local scripts/replay-control.ts
import { readFileSync, writeFileSync } from "node:fs";
import { insights, qlooCallCount } from "../lib/qloo.ts";
import { applyMissingRule } from "../lib/review.ts";

const CHANCE = 3 / 8;
const choose = (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
const tail = (n: number, k: number) => { let s = 0; for (let i = k; i <= n; i++) s += choose(n, i) * CHANCE ** i * (1 - CHANCE) ** (n - i); return s; };

type Case = { seed: string; partner: string; seedId: string; partnerId: string; decoys: { id: string }[]; result?: { state?: string; rank?: number } };
const cases: Case[] = ["audit/replay.json", "audit/replay-v2.json"].flatMap((f) => JSON.parse(readFileSync(f, "utf8")).cases).filter((c: Case) => c.result?.state === "scored");
const draw: { cases: { case: string; scrambledSeed: string; scrambledSeedId: string }[] } = JSON.parse(readFileSync("audit/replay-control-draw.json", "utf8"));
if (draw.cases.length !== cases.length || draw.cases.some((d, i) => d.case !== `${cases[i].seed} x ${cases[i].partner}`)) throw new Error("draw and cases out of step");

const realHits = cases.filter((c) => c.result!.rank! <= 3).length;
console.log(`${cases.length} cases. Real hits ${realHits}. PASS needs scrambled hits <= 12 and real - scrambled >= 4.\n`);
const two = (v: number) => Math.round(v * 100) / 100;
const rows = [];
for (const [i, c] of cases.entries()) {
  const d = draw.cases[i];
  const ids = [c.partnerId, ...c.decoys.map((x) => x.id)];
  const got = new Map((await insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": d.scrambledSeedId, "filter.results.entities": ids.join(","), take: ids.length })).map((h) => [h.entity_id, h.affinity]));
  const cells = applyMissingRule(ids.map((id) => got.get(id)), "one call");
  const val = new Map(ids.map((id, j) => [id, cells[j].value]));
  const partner = val.get(c.partnerId);
  const measured = ids.filter((id) => val.get(id) !== null).sort((a, b) => val.get(b)! - val.get(a)!);
  const rank = partner == null ? null : measured.indexOf(c.partnerId) + 1;
  const row = { case: d.case, scrambledSeed: d.scrambledSeed, realRank: c.result!.rank!, scrambledRank: rank, of: measured.length, hit: rank === null || rank <= 3, noMeasurement: rank === null, scores: Object.fromEntries(ids.map((id) => [id, val.get(id) == null ? null : two(val.get(id)!)])) };
  rows.push(row);
  console.log(`${d.case} under ${d.scrambledSeed}: ${rank === null ? "no measurement (counted as a hit)" : `rank ${rank} of ${measured.length}`}, real rank ${row.realRank}${row.hit ? " HIT" : ""}`);
}
const hits = rows.filter((r) => r.hit).length;
const ranked = rows.filter((r) => r.scrambledRank !== null);
const summary = {
  cases: rows.length, realHits, scrambledHits: hits, noMeasurement: rows.length - ranked.length,
  pass: hits <= 12 && realHits - hits >= 4,
  meanScrambledRank: two(ranked.reduce((s, r) => s + r.scrambledRank!, 0) / (ranked.length || 1)), chanceMeanRank: 4.5,
  pOfAtLeastScrambled: Number(tail(rows.length, hits).toPrecision(2)),
};
console.log(`\nScrambled hits ${hits} of ${rows.length} (real ${realHits}): ${summary.pass ? "PASS" : "FAIL"}; mean scrambled rank ${summary.meanScrambledRank} vs 4.5. Qloo calls: ${qlooCallCount()}`);
writeFileSync("audit/replay-control.json", JSON.stringify({ stage: "scored", scoredAt: new Date().toISOString().slice(0, 10), protocol: "audit/replay-control-protocol.md", summary, cases: rows }, null, 2) + "\n");
process.exit(0);
