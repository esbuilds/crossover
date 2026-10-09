// One-off: run the per-domain ranking agent on a demo fixture and save the result to
// fixtures/demo/rank-<slug>.json (gitignored). Six Opus 5.5 calls, no Qloo calls.
//   node --env-file=.env.local scripts/record-rank.ts liquid-death
import { readFileSync, writeFileSync } from "node:fs";
import { rank, seedFromCard, RANK_EFFORT, type Ranking } from "../lib/agent/rank.ts";
import { toCard } from "../lib/slate.ts";

const slug = process.argv[2] ?? "liquid-death";
const fx = JSON.parse(readFileSync(new URL(`../fixtures/demo/${slug}.json`, import.meta.url), "utf8"));
const seed = seedFromCard(toCard(fx.resolution.match));
const ranking = {} as Ranking;
const started = Date.now();
await rank(seed, fx.slate, (d, r) => r && (ranking[d] = r.ranking));
writeFileSync(new URL(`../fixtures/demo/rank-${slug}.json`, import.meta.url), JSON.stringify({ version: "rank-v2", effort: RANK_EFFORT, seed, ranking }, null, 2) + "\n");
console.log(`${seed.name} ranked in ${Date.now() - started} ms`);
