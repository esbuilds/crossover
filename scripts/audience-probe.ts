// Audience read probe (world-class item 7, Eric's features push, real Oct 14): does a Qloo audience segment reorder a
// prepared ask's frozen eight? Gate set before the run: for each of the three seeds, at least one audience changes the
// top three AND moves some candidate by 2 or more ranks. Else publish the flat result and build nothing. About 12 calls.
//   QLOO_DAILY_CAP=<n> node --env-file=.env.local scripts/audience-probe.ts
import { readFileSync } from "node:fs";
import { audiences, insights } from "../lib/qloo.ts";

const ASKS = [
  { label: "Allbirds", seed: "78A44C09-E691-42DA-A553-5CDE6EE9B18A", fixture: "allbirds" },
  { label: "Mt. Joy", seed: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", fixture: "mt-joy" },
];
const eightOf = (f: string) => (JSON.parse(readFileSync(`lib/ask/fixtures/${f}.json`, "utf8")) as { type: string; output?: { candidates?: { name: string; id: string }[] } }[]).find((e) => e.type === "result" && e.output?.candidates)!.output!.candidates!;
const life = await audiences("urn:audience:life_stage");
const spend = await audiences("urn:audience:spending_habits");
console.log("life_stage:", life.slice(0, 12).map((a) => a.name).join(" | "));
console.log("spending_habits:", spend.slice(0, 12).map((a) => a.name).join(" | "));
const pickA = (list: { id: string; name: string }[], words: RegExp) => list.find((a) => words.test(a.name)) ?? list[0];
const SEGS = [pickA(life, /parent/i), pickA(life, /student|college/i), pickA(spend, /luxury|high/i)].filter(Boolean);
console.log("segments:", SEGS.map((s) => s.name).join(" | "));
let pass = 0;
for (const a of ASKS) {
  const eight = eightOf(a.fixture);
  const ids = eight.map((c) => c.id).join(",");
  const name = new Map(eight.map((c) => [c.id, c.name]));
  const rank = async (extra: Record<string, string>) => (await insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": a.seed, "filter.results.entities": ids, take: 8, ...extra })).sort((x, y) => (y.affinity ?? 0) - (x.affinity ?? 0)).map((h) => ({ id: h.entity_id, aff: h.affinity ?? 0 }));
  const base = await rank({});
  console.log(`\n## ${a.label} national: ${base.map((r) => `${name.get(r.id)} ${r.aff.toFixed(2)}`).join(", ")}`);
  let ok = false;
  for (const s of SEGS) {
    const r = await rank({ "signal.demographics.audiences": s.id });
    const top = (x: { id: string }[]) => x.slice(0, 3).map((y) => y.id).sort().join();
    const maxShift = Math.max(...r.map((x, i) => Math.abs(i - base.findIndex((b) => b.id === x.id))));
    const changed = top(r) !== top(base) && maxShift >= 2;
    if (changed) ok = true;
    console.log(`  ${s.name}: ${r.map((x) => `${name.get(x.id)} ${x.aff.toFixed(2)}`).join(", ")} | max shift ${maxShift}${changed ? " <- reorders" : ""}`);
  }
  if (ok) pass++;
}
console.log(`\nGATE: ${pass} of ${ASKS.length} seeds reorder under some audience (need all).`);
