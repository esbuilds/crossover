// Reverse-rank probe (real Oct 15, research/report-oct15-columns.md): the seed's rank among each candidate's fans' brands,
// the same rankIn as lib/review-run.ts (take 50), fetched into the same cache so the ask's block can read it later.
// Gate written before the run: A) the agent's three differ by 5+ positions (or one is outside the top 50);
// B) the reverse order isn't the forward order for the three.
//   QLOO_DAILY_CAP=<n> node --env-file=.env.local scripts/reverse-probe.ts [allbirds|mt-joy|converse]
// Reads the frozen answers from the cache (peekAsk, as scripts/ask-hashes.ts), never re-runs them.
import { insights } from "../lib/qloo.ts";
import { peekAsk } from "../lib/ask/agent.ts";

const ASKS = {
  allbirds: { id: "78A44C09-E691-42DA-A553-5CDE6EE9B18A", type: "urn:entity:brand" },
  "mt-joy": { id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: "urn:entity:artist" },
  converse: { id: "A539C8C9-4733-41A9-911A-11AC2B6D475A", type: "urn:entity:brand", caseKey: "coca-cola-x-converse" },
} as const;
const steps = (await peekAsk(ASKS[(process.argv[2] ?? "allbirds") as keyof typeof ASKS])) as any[];
if (!steps) throw new Error("frozen ask not cached");
const seed = steps.find((e) => e.output?.state && e.output?.id).output;
const ranks = steps.find((e) => e.output?.ranks).output.ranks as { name: string; amongSeedFans: number | null }[];
const cands = steps.find((e) => e.output?.candidates).output.candidates as { name: string; id: string }[];
const three = steps.findLast((e) => e.type === "decision").decision.calls.map((c: { name: string }) => c.name.replace(/\[\[|\]\]/g, "")) as string[];

const rows = [];
for (const c of cands) {
  const list = await insights({ "filter.type": seed.type, "signal.interests.entities": c.id, take: 50 });
  const rev = list.findIndex((e) => e.entity_id === seed.id) + 1 || null;
  rows.push({ name: c.name, fwd: ranks.find((r) => r.name === c.name)?.amongSeedFans ?? null, rev });
}
console.log(`${seed.name}: forward rank (among ${seed.name} fans) | reverse rank (${seed.name} among theirs)`);
for (const r of rows) console.log(`  ${three.includes(r.name) ? "*" : " "} ${r.name.padEnd(24)} ${String(r.fwd).padStart(4)} | ${r.rev ?? "not in top 50"}`);
const t = rows.filter((r) => three.includes(r.name));
const revs = t.map((r) => r.rev ?? 51);
const a = Math.max(...revs) - Math.min(...revs) >= 5;
const byRev = [...rows].sort((x, y) => (x.rev ?? 51) - (y.rev ?? 51)).map((r) => r.name);
const b = t.some((r, i) => byRev.indexOf(r.name) !== i);
console.log(`GATE A spread among the three: ${revs.join(", ")} -> ${a ? "PASS" : "FAIL"}`);
console.log(`GATE B reverse order differs: top three by reverse = ${byRev.slice(0, 3).join(", ")} -> ${b ? "PASS" : "FAIL"}`);
console.log(`OVERALL: ${a && b ? "PASS" : "FAIL"}`);
