// One-off: run the ranking agent on a demo fixture and save the result to fixtures/demo/rank-<slug>.json
// (gitignored). One Opus 5.5 call, no Qloo calls.
//   node --env-file=.env.local scripts/record-rank.ts liquid-death
import { readFileSync, writeFileSync } from "node:fs";
import { rank } from "../lib/agent/rank.ts";
import { toCard } from "../lib/slate.ts";

const slug = process.argv[2] ?? "liquid-death";
const fx = JSON.parse(readFileSync(new URL(`../fixtures/demo/${slug}.json`, import.meta.url), "utf8"));
const seed = toCard(fx.resolution.match);
const started = Date.now();
const result = await rank(seed, fx.slate);
writeFileSync(new URL(`../fixtures/demo/rank-${slug}.json`, import.meta.url), JSON.stringify({ seed, ...result }, null, 2) + "\n");
console.log(`${seed.name} ranked in ${Date.now() - started} ms`, JSON.stringify(result.usage));
