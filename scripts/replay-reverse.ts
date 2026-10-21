// The reverse replay (PROOF-2, audit/replay-reverse-protocol.md). For each of the 23 frozen cases, each of the eight's
// fans' top 50 brands, and where the seed sits in it; the scrambled seed (audit/replay-control-draw.json) is read from
// the same responses, so the control costs no extra call. One call per distinct candidate (106 at most, cached after).
// Writes audit/replay-reverse.json only.
//   node --env-file=.env.local scripts/replay-reverse.ts
import { readFileSync, writeFileSync } from "node:fs";
import { insights, qlooCallCount } from "../lib/qloo.ts";
import { partnerRank } from "../lib/replay-reverse.ts";

const CHANCE = 3 / 8, NEED = 13;
const choose = (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
const tail = (n: number, k: number) => { let s = 0; for (let i = k; i <= n; i++) s += choose(n, i) * CHANCE ** i * (1 - CHANCE) ** (n - i); return s; };

type Case = { seed: string; partner: string; seedId: string; partnerId: string; partnerMatched: string; decoys: { id: string; name: string }[]; result?: { state?: string; rank?: number } };
const cases: Case[] = ["audit/replay.json", "audit/replay-v2.json"].flatMap((f) => JSON.parse(readFileSync(f, "utf8")).cases).filter((c: Case) => c.result?.state === "scored");
const draw: { cases: { case: string; scrambledSeed: string; scrambledSeedId: string }[] } = JSON.parse(readFileSync("audit/replay-control-draw.json", "utf8"));
if (draw.cases.some((d, i) => d.case !== `${cases[i].seed} x ${cases[i].partner}`)) throw new Error("draw and cases out of step");
console.log(`${cases.length} cases. PASS needs real hits >= ${NEED} and real - scrambled >= 4.\n`);

type Row = { case: string; scrambledSeed: string; forwardRank: number; noMeasurement: boolean; realRank: number; realHit: boolean; scrambledRank: number; scrambledHit: boolean; cells: { name: string; seed: number | null; scrambledSeed: number | null }[] };
const rows: Row[] = [];
for (const [i, c] of cases.entries()) {
  const d = draw.cases[i];
  const eight = [{ id: c.partnerId, name: c.partnerMatched }, ...c.decoys];
  const lists: string[][] = [];
  for (const e of eight) lists.push((await insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": e.id, take: 50 })).map((x) => x.entity_id));
  const pos = (seedId: string) => lists.map((l) => (l.indexOf(seedId) + 1) || null);
  const real = pos(c.seedId), scr = pos(d.scrambledSeedId);
  const noMeasurement = lists.some((l) => l.length === 0); // a candidate whose fans' list came back empty
  const realRank = partnerRank(real, 0), scrambledRank = partnerRank(scr, 0);
  const row: Row = {
    case: d.case, scrambledSeed: d.scrambledSeed, forwardRank: c.result!.rank!, noMeasurement,
    realRank, realHit: !noMeasurement && realRank <= 3, scrambledRank, scrambledHit: noMeasurement || scrambledRank <= 3,
    cells: eight.map((e, j) => ({ name: e.name, seed: real[j], scrambledSeed: scr[j] })),
  };
  rows.push(row);
  console.log(`${d.case}: partner's fans rank ${c.seed} ${real[0] ?? "out"}, rank ${realRank} of 8${row.realHit ? " HIT" : ""} | under ${d.scrambledSeed}: ${scr[0] ?? "out"}, rank ${scrambledRank}${row.scrambledHit ? " HIT" : ""}${noMeasurement ? " (no measurement)" : ""}`);
}
const realHits = rows.filter((r) => r.realHit).length, scrambledHits = rows.filter((r) => r.scrambledHit).length;
const mean = (k: "realRank" | "scrambledRank") => Math.round((rows.reduce((s, r) => s + r[k], 0) / rows.length) * 100) / 100;
const summary = {
  cases: rows.length, need: NEED, realHits, scrambledHits, noMeasurement: rows.filter((r) => r.noMeasurement).length,
  pass: realHits >= NEED && realHits - scrambledHits >= 4,
  pOfAtLeastReal: Number(tail(rows.length, realHits).toPrecision(2)),
  meanRealRank: mean("realRank"), meanScrambledRank: mean("scrambledRank"),
  seedOutCells: rows.reduce((s, r) => s + r.cells.filter((x) => x.seed === null).length, 0), cells: rows.length * 8,
  v2: { cases: 14, realHits: rows.slice(9).filter((r) => r.realHit).length, scrambledHits: rows.slice(9).filter((r) => r.scrambledHit).length },
};
console.log(`\nReal ${realHits} of ${rows.length} (need ${NEED}), scrambled ${scrambledHits}: ${summary.pass ? "PASS" : "FAIL"}. Mean rank ${summary.meanRealRank} real, ${summary.meanScrambledRank} scrambled. Seed out of a top 50 in ${summary.seedOutCells} of ${summary.cells} lists. Qloo calls: ${qlooCallCount()}`);
writeFileSync("audit/replay-reverse.json", JSON.stringify({ stage: "scored", scoredAt: new Date().toISOString().slice(0, 10), protocol: "audit/replay-reverse-protocol.md", summary, cases: rows }, null, 2) + "\n");
process.exit(0);
