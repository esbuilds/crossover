// One-off: per-domain ranking at effort low vs medium on the four demo slates (fixtures/demo, no Qloo calls).
//   node --env-file=.env.local scripts/compare-effort.ts
import { readFileSync, writeFileSync } from "node:fs";
import { rankDomainUncached, seedFromCard, type Effort, type Ranking } from "../lib/agent/rank.ts";
import { DOMAINS, toCard, type Slate } from "../lib/slate.ts";

const price = (u: { inputTokenDetails: { noCacheTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number }; outputTokens?: number }) =>
  ((u.inputTokenDetails.noCacheTokens ?? 0) * 4 + (u.inputTokenDetails.cacheWriteTokens ?? 0) * 5 + (u.inputTokenDetails.cacheReadTokens ?? 0) * 0.2 + (u.outputTokens ?? 0) * 20) / 1e6;

const rows: string[] = [];
const all: Record<string, Ranking> = {};
for (const slug of ["liquid-death", "olipop", "mt-joy", "somebody-feed-phil"]) {
  const fx = JSON.parse(readFileSync(new URL(`../fixtures/demo/${slug}.json`, import.meta.url), "utf8"));
  const seed = seedFromCard(toCard(fx.resolution.match));
  const slate: Slate = fx.slate;
  for (const effort of ["low", "medium"] as Effort[]) {
    const t0 = Date.now();
    const results = await Promise.all(DOMAINS.map((d) => rankDomainUncached(seed, d, slate[d], effort).then((r) => [d, r] as const)));
    const secs = (Date.now() - t0) / 1000;
    const ranking = Object.fromEntries(results.map(([d, r]) => [d, r.ranking])) as Ranking;
    all[`${slug}/${effort}`] = ranking;
    const cost = results.reduce((s, [, r]) => s + price(r.usage as never), 0);
    const kept = results.reduce((s, [, r]) => s + r.ranking.kept.length, 0);
    const dropped = results.flatMap(([, r]) => r.ranking.dropped.map((x) => x.name));
    const checks =
      slug === "liquid-death"
        ? `JoeRogan:${dropped.includes("The Joe Rogan Experience")} 22Red:${dropped.includes("22Red")} lodges:${dropped.filter((n) => /Lodge|Resort/.test(n)).join("/") || "none"}`
        : slug === "mt-joy"
          ? `ski:${dropped.filter((n) => /Ski|Mountain Resort/.test(n)).join("/") || "none"}`
          : "";
    rows.push(`${slug.padEnd(20)} ${effort.padEnd(6)} ${secs.toFixed(1).padStart(5)}s  $${cost.toFixed(3)}  kept ${kept}  dropped ${dropped.length}  ${checks}`);
    console.log(rows.at(-1));
  }
}
writeFileSync(process.argv[2] ?? "/tmp/effort-compare.json", JSON.stringify(all, null, 2));
