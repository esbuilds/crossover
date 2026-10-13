// Historical replay, stage 2 of 2 (audit/replay-protocol.md). Run only after the protocol, the cases and the built
// lists are frozen in git. One forward call per case; prints the pass threshold before any result.
// Updates audit/replay.json with ranks (derived numbers only).
//   QLOO_DAILY_CAP=<n> node --env-file=.env.local scripts/replay-score.ts [audit/replay.json]
import { readFileSync, writeFileSync } from "node:fs";
import { insights, qlooCallCount } from "../lib/qloo.ts";
import { applyMissingRule, GAP } from "../lib/review.ts";

const CHANCE = 3 / 8;
const choose = (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
const tail = (n: number, k: number) => { let s = 0; for (let i = k; i <= n; i++) s += choose(n, i) * CHANCE ** i * (1 - CHANCE) ** (n - i); return s; };
export const threshold = (n: number) => { for (let k = 0; k <= n; k++) if (tail(n, k) < 0.05) return k; return n + 1; };

type Built = { seed: string; partner: string; seedId: string; partnerId: string; decoys: { name: string; id: string; popularity: number }[]; partnerPopularity: number; dropped?: string };
const path = process.argv[2] ?? "audit/replay.json";
const file = JSON.parse(readFileSync(path, "utf8"));
const built: Built[] = file.cases.filter((c: Built) => !c.dropped);
console.log(`${built.length} cases. Pass needs ${threshold(built.length)} or more hits (one-sided binomial under 3 in 8, p < 0.05).\n`);

const two = (v: number) => Math.round(v * 100) / 100;
let hits = 0, scored = 0;
const ranks: number[] = [];
for (const c of built) {
  const ids = [c.partnerId, ...c.decoys.map((d) => d.id)];
  const got = new Map((await insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": c.seedId, "filter.results.entities": ids.join(","), take: ids.length })).map((h) => [h.entity_id, h.affinity]));
  const cells = applyMissingRule(ids.map((id) => got.get(id)), "one call");
  const val = new Map(ids.map((id, i) => [id, cells[i].value]));
  const partner = val.get(c.partnerId);
  const measured = ids.filter((id) => val.get(id) !== null).sort((a, b) => val.get(b)! - val.get(a)!);
  const pops = [{ id: c.partnerId, p: c.partnerPopularity }, ...c.decoys.map((d) => ({ id: d.id, p: d.popularity }))].sort((a, b) => b.p - a.p);
  const result = partner == null
    ? { state: "no measurement" as const }
    : { state: "scored" as const, rank: measured.indexOf(c.partnerId) + 1, of: measured.length, affinity: two(partner), top: two(val.get(measured[0])!), inTopGroup: val.get(measured[0])! - partner < GAP, popularityRank: pops.findIndex((x) => x.id === c.partnerId) + 1 };
  Object.assign(c, { result, scores: Object.fromEntries(ids.map((id) => [id, val.get(id) == null ? null : two(val.get(id)!)])) });
  if (result.state === "scored") { scored++; ranks.push(result.rank); if (result.rank <= 3) hits++; }
  console.log(`${c.seed} x ${c.partner}: ${result.state === "scored" ? `rank ${result.rank} of ${result.of} (${result.affinity} vs top ${result.top})${result.rank <= 3 ? " HIT" : ""}` : "no measurement"}`);
}
const need = threshold(scored);
const mean = ranks.reduce((a, b) => a + b, 0) / (ranks.length || 1);
const summary = { scored, hits, need, pass: hits >= need, meanRank: two(mean), chanceMeanRank: 4.5, pOfAtLeast: Number(tail(scored, hits).toPrecision(2)) };
console.log(`\n${hits} hits of ${scored} scored (need ${need}): ${summary.pass ? "PASS" : "FAIL"}; mean rank ${summary.meanRank} vs 4.5 by chance; P(>= ${hits} by chance) = ${summary.pOfAtLeast}. Qloo calls: ${qlooCallCount()}`);
writeFileSync(path, JSON.stringify({ ...file, stage: "scored", scoredAt: new Date().toISOString().slice(0, 10), summary }, null, 2) + "\n");
