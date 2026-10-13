// Redundancy probe (Perplexity moonshot 1, real Oct 13): do the audit briefs' candidates differ in how much they share
// an audience with each other, enough that a "least redundant three" is a different, defensible pick?
// Input: the as-run review outputs (probe/out-review, .v2 where present), so no name is re-resolved.
// Per brief: each measured, eligible candidate scores the others in one call (same-type affinity is symmetric, so the
// last candidate is skipped). Pool = candidates within GAP of the third-highest forward affinity. Least redundant three
// = the pool's 3-set with the lowest mean pairwise affinity.
// Brief passes when that set differs from the affinity top three AND its mean pairwise sits GAP or more below theirs.
// Gate: 4 of 12 briefs pass. About 70 calls, serial. Derived numbers only to stdout; raw matrix to <outDir>.
//   node --env-file=.env.local scripts/redundancy-probe.ts <reviewDir> <outDir>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { insights, qlooCallCount } from "../lib/qloo.ts";
import { applyMissingRule, GAP } from "../lib/review.ts";

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error("usage: scripts/redundancy-probe.ts <reviewDir> <outDir>");
const seeds: string[] = JSON.parse(readFileSync("audit/briefs.json", "utf8")).split.order;

type Row = { input: string; entity: { entity_id: string; type: string }; forward: { value: number | null }; gate: { state: string } };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const triples = <T>(xs: T[]) => xs.flatMap((a, i) => xs.slice(i + 1).flatMap((b, j) => xs.slice(i + j + 2).map((c) => [a, b, c])));
const two = (v: number) => v.toFixed(2);

let passed = 0;
const raw: Record<string, unknown> = {};
for (const seed of seeds) {
  const file = existsSync(`${dir}/${seed}.v2.json`) ? `${dir}/${seed}.v2.json` : `${dir}/${seed}.json`;
  const r = JSON.parse(readFileSync(file, "utf8"));
  const g = r.groups.find((x: { type: string }) => x.type === "urn:entity:brand") ?? r.groups[0];
  const rows: Row[] = g.rows.filter((x: Row) => x.forward.value !== null && x.gate.state === "eligible");
  rows.sort((a, b) => b.forward.value! - a.forward.value!);
  if (rows.length < 4) { console.log(`\n## ${seed}: ${rows.length} measured, skipped`); continue; }

  // pairwise matrix, symmetric
  const pair = new Map<string, number | null>();
  const k = (a: string, b: string) => [a, b].sort().join("|");
  for (const [i, c] of rows.entries()) {
    const others = rows.slice(i + 1);
    if (!others.length) break;
    const hits = await insights({ "filter.type": c.entity.type, "signal.interests.entities": c.entity.entity_id, "filter.results.entities": others.map((o) => o.entity.entity_id).join(","), take: others.length });
    const got = new Map(hits.map((h) => [h.entity_id, h.affinity]));
    applyMissingRule(others.map((o) => got.get(o.entity.entity_id)), "one call").forEach((cell, j) => pair.set(k(c.entity.entity_id, others[j].entity.entity_id), cell.value));
  }
  raw[seed] = Object.fromEntries(pair);

  const f3 = rows[2].forward.value!;
  const pool = rows.filter((x) => x.forward.value! >= f3 - GAP);
  const red = (t: Row[]) => {
    const vs = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => pair.get(k(t[a].entity.entity_id, t[b].entity.entity_id)));
    return vs.some((v) => v == null) ? null : mean(vs as number[]);
  };
  const top = rows.slice(0, 3);
  const scored = triples(pool).map((t) => ({ t, r: red(t) })).filter((x) => x.r !== null).sort((a, b) => a.r! - b.r!);
  const best = scored[0];
  const topR = red(top);
  const all = [...pair.values()].filter((v): v is number => v !== null);
  const names = (t: Row[]) => t.map((x) => `${x.input} ${two(x.forward.value!)}`).join(", ");
  const differs = best && top.some((x) => !best.t.includes(x));
  const pass = !!(best && topR !== null && differs && topR - best.r! >= GAP);
  if (pass) passed++;
  console.log(`\n## ${seed}: ${rows.length} measured, pool ${pool.length}, pairwise ${all.length} (${pair.size - all.length} missing), range ${two(Math.min(...all))}-${two(Math.max(...all))}`);
  console.log(`top three by affinity: ${names(top)}; mean pairwise ${topR === null ? "missing" : two(topR)}`);
  console.log(`least redundant: ${best ? `${names(best.t)}; mean pairwise ${two(best.r!)}` : "none (missing cells)"} -> ${pass ? "PASS" : differs ? "differs, gap under 0.05" : "same three"}`);
}
writeFileSync(`${out}/redundancy-matrix.json`, JSON.stringify(raw, null, 2));
console.log(`\nGATE: ${passed} of ${seeds.length} briefs pass (need 4). Qloo calls this run: ${qlooCallCount()}`);
