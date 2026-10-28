// Markets probe: does each of Allbirds' eight lead in different metros?
// Gate set before the run: A) at least two of the eight differ from Allbirds' top five
// in two or more metros; B) at least one of the agent's three has Austin, Seattle or Dallas (Outdoor Voices' lead
// markets) in its top five. One US heatmap per candidate, 8 calls; Allbirds' own map is cached.
//   QLOO_DAILY_CAP=<n> node --env-file=.env.local scripts/markets-probe.ts
import { getCities } from "../lib/cities.ts";

const SEED = "78A44C09-E691-42DA-A553-5CDE6EE9B18A";
const THREE = ["Bombas", "Warby Parker", "ClassPass"];
const RIVAL_LEADS = ["Austin", "Seattle", "Dallas"];
const ab = (await import(new URL("../lib/ask/fixtures/allbirds.json", import.meta.url).href, { with: { type: "json" } })).default as { type: string; output?: { candidates?: { name: string; id: string }[] } }[];
const eight = ab.find((e) => e.type === "result" && e.output?.candidates)!.output!.candidates!;

const top5 = async (id: string) => (await getCities(id)).metros.slice(0, 5);
const seedTop = (await top5(SEED)).map((m) => m.name);
console.log(`Allbirds top five: ${seedTop.join(", ")}\n`);

let differ = 0;
const rivalHit: string[] = [];
for (const c of eight) {
  const metros = await top5(c.id);
  const names = metros.map((m) => m.name);
  const off = names.filter((n) => !seedTop.includes(n));
  const inRival = names.filter((n) => RIVAL_LEADS.some((r) => n.startsWith(r)));
  if (off.length >= 2) differ++;
  if (THREE.includes(c.name) && inRival.length) rivalHit.push(`${c.name} (${inRival.join(", ")})`);
  console.log(`${c.name.padEnd(14)} ${metros.map((m) => `${m.name} ${m.overIndex}`).join(" | ")}  -> ${off.length} differ${inRival.length ? `, rival metros: ${inRival.join(", ")}` : ""}`);
}
const a = differ >= 2;
const b = rivalHit.length > 0;
console.log(`\nGATE A: ${differ} of 8 differ in 2+ metros (need 2) -> ${a ? "PASS" : "FAIL"}`);
console.log(`GATE B: ${rivalHit.join("; ") || "none of the three"} -> ${b ? "PASS" : "FAIL"}`);
console.log(`OVERALL: ${a && b ? "PASS" : "FAIL"}`);
