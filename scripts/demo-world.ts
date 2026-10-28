// The demo world: three made-up asks shaped like the recorded ones in lib/ask/fixtures/, so the tests
// and npm run verify run without Qloo data in the repo (Qloo's hackathon guide: no response data in a public repository).
// It runs only where the recorded asks exist (the private repo):
//   node --disable-warning=ExperimentalWarning scripts/demo-world.ts <map-out.json> [out-dir, default lib/ask/demo]
// Names come from the invented list below, ids are fresh, cities are swapped for other metros, and every score is
// redrawn at random (crypto, unseeded, so the recorded values can't be worked back) under checks that keep every order,
// every tie, every comparison against the 0.05 gap and the 0.3 floor and 0.5 cap. Answer text goes through the same
// maps, and the checker must pass every decision with the same claim count. The map file pairs recorded and invented
// names: write it outside the repo.
import { randomInt, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { checkDecision, claimCount } from "../lib/ask/check.ts";
import { decisionEvent, stepsFrom } from "../lib/ask/steps.ts";
import { INVENTED } from "../lib/ask/tamper.ts";
import type { AskEvent } from "../lib/ask/agent.ts";
import metros from "../data/metros.json" with { type: "json" };

const SEEDS = ["allbirds", "mt-joy", "liquid-death"];
const BRANDS = ["Fernway", "Corvid & Co.", "Tallgrass Goods", "Lumen Sock Co.", "Brightwell Optics", "Pallet Fitness", "Hearthline", "Dovetail Sleep", "Kestrel Knit", "Marlow Basics", "Tidewater Swim", "Quillon", "Sundry Peak", "Oakhollow", "Larkspur Labs", "Ember Cola", "Halvard", "Pinecrest Supply", "Westbound Denim", "Glasshouse Water", "Copperline", "Nettle & Rye", "Bramble Coffee", "Stonefly Outfitters", "Harbor Cut", "Velvet Anvil", "Ironleaf", "Saltmarsh Skate", "Gravel Kings", "Northwick", "Ashgrove", "Tinderbox Audio", "Crestfall Apparel", "Riverbend Soap", "Foxglove Market", "Bluehour", "Sparrow Swim", "Kilnworks", "Driftline", "Morrow Tea", "Hollis Bike", "Juniper Row", "Calder Shoe", "Ridgeback Gear", "Lantern Pet", "Wren & Lark", "Coldspring", "Brindle", "Mesa Grip"];
const ARTISTS = ["Low Tide Choir"];
const AFF = new Set(["affinity", "value", "next", "seed", "rival"]), POP = new Set(["popularity"]);
const UUID = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/gi;
const TEXT_SCORE = /(?<![\w.])0\.\d\d(?!\d)/g; // two-place scores in text; the method's 0.05 is left alone

const pick = <T>(xs: T[]): T => xs.splice(randomInt(xs.length), 1)[0];
const recorded = Object.fromEntries(SEEDS.map((s) => [s, JSON.parse(readFileSync(new URL(`../lib/ask/fixtures/${s}.json`, import.meta.url), "utf8")) as AskEvent[]]));

// names: every "name" value and every bracketed name; cities go to other metros, the artist seed to an invented artist
const cities = new Set(metros.flatMap((m) => [m.name, ...((m as { also?: { name: string }[] }).also ?? []).map((a) => a.name)]));
const names = new Set<string>(), artists = new Set<string>();
const walk = (x: unknown, f: (k: string | null, v: unknown) => void, k: string | null = null): void => {
  f(k, x);
  if (Array.isArray(x)) x.forEach((v) => walk(v, f, k));
  else if (x && typeof x === "object") for (const [kk, v] of Object.entries(x)) walk(v, f, kk);
};
for (const ev of Object.values(recorded)) {
  walk(ev, (k, v) => { if (k === "name" && typeof v === "string") names.add(v); if (typeof v === "string") for (const m of v.matchAll(/\[\[([^\]]+)\]\]/g)) names.add(m[1]); });
  walk(ev, (_, v) => { const o = v as { type?: string; name?: string }; if (o?.type === "urn:entity:artist" && o.name) artists.add(o.name); });
}
const brandPool = BRANDS.filter((b) => b !== INVENTED), artistPool = [...ARTISTS], cityPool = [...cities].filter((c) => !names.has(c));
const nameMap = new Map([...names].map((n) => [n, cities.has(n) ? pick(cityPool) : artists.has(n) ? pick(artistPool) : pick(brandPool)]));
const idMap = new Map<string, string>();
const mapId = (id: string) => idMap.get(id.toUpperCase()) ?? (idMap.set(id.toUpperCase(), randomUUID().toUpperCase()), idMap.get(id.toUpperCase())!);
const longestFirst = [...nameMap.keys()].sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NAMES = new RegExp(`(?<![\\w])(${longestFirst.map(esc).join("|")})(?![\\w])('(?!s))?`, "g"); // with a bare possessive ("Allbirds'")
const rename = (_: string, n: string, apos?: string) => { const to = nameMap.get(n)!; return apos ? (to.endsWith("s") ? `${to}'` : `${to}'s`) : to; };

// scores, in hundredths: one family for affinity-like values, one for popularity, per ask
const sign = (x: number) => Math.sign(x);
// the 0.05 tie rule and the checker attack's 0.03 nudge; 0.97 stays a fixed point because the attack's one published
// miss is 0.97 nudged to 1.00, which matches a rank of 1 in the cited step
const GAPS = [5, 3];
function redraw(values: number[], fixed: number[]): Map<number, number> {
  const d = [...new Set(values)].filter((v) => v > 0).sort((a, b) => a - b);
  const keeps = (m: Map<number, number>) =>
    d.every((a) => m.get(a)! >= 1 && m.get(a)! <= 100 && fixed.every((f) => sign(a - f) === sign(m.get(a)! - f))) &&
    d.every((a) => d.every((b) => sign(a - b) === sign(m.get(a)! - m.get(b)!) && GAPS.every((g) => sign(Math.abs(a - b) - g) === sign(Math.abs(m.get(a)! - m.get(b)!) - g))));
  for (let tries = 0; tries <= 200; tries++) {
    const shift = tries === 200 ? 0 : [-3, -2, -1, 1, 2, 3][randomInt(6)], m = new Map(d.map((v) => [v, v + shift])); // 0: a family holding a fixed point
    if (!keeps(m)) continue;
    for (const v of [...d].sort(() => randomInt(3) - 1)) {
      for (const j of [-2, -1, 1, 2].sort(() => randomInt(3) - 1)) {
        const was = m.get(v)!;
        m.set(v, was + j);
        if (keeps(m)) break;
        m.set(v, was);
      }
    }
    return m;
  }
  throw new Error("no redraw keeps every relation");
}

// Families are per step: the rules compare scores inside one step's output, never across steps. A step whose scores sit
// one hundredth apart can only shift as a block; each step draws its own shift.
// ponytail: a text score is mapped through the families of the steps its sentence cites; a clash throws, and a rerun
// draws again.
type Fam = { aff: Map<number, number>; pop: Map<number, number> };
const out: Record<string, AskEvent[]> = {};
for (const [seed, ev] of Object.entries(recorded)) {
  // steps one sentence cites together share a family, so a number it quotes from either maps one way
  const root = new Map<number, number>(), find = (n: number): number => (root.get(n) ?? n) === n ? n : find(root.get(n)!);
  const d0 = decisionEvent(ev);
  if (d0?.type === "decision" && d0.decision) for (const it of [...d0.decision.calls, ...d0.decision.cautions, ...d0.decision.summary]) for (const n of it.steps) root.set(find(n), find(it.steps[0]));
  const scores = new Map<number, { aff: number[]; pop: number[] }>();
  for (const e of ev) {
    if (e.type !== "result") continue;
    const s = scores.get(find((e as { n: number }).n)) ?? { aff: [], pop: [] };
    walk((e as { output: unknown }).output, (k, v) => { if (typeof v === "number" && k && v >= 0 && v <= 1) (AFF.has(k) ? s.aff : POP.has(k) ? s.pop : []).push(Math.round(v * 100)); });
    scores.set(find((e as { n: number }).n), s);
  }
  const drawn = new Map([...scores].map(([r, s]) => [r, { aff: redraw(s.aff, [0, 97, 100]), pop: redraw(s.pop, [0, 30, 50, 100]) }]));
  const fams = new Map<number, Fam>(ev.filter((e) => e.type === "result").map((e) => [(e as { n: number }).n, drawn.get(find((e as { n: number }).n))!]));
  const str = (s: string, steps: number[]) => s.replace(NAMES, rename).replace(UUID, mapId).replace(TEXT_SCORE, (t) => {
    if (t === "0.05") return t;
    const c = Math.round(Number(t) * 100), to = new Set(steps.map((n) => fams.get(n)?.aff.get(c)).filter((v) => v !== undefined));
    if (to.size !== 1) throw new Error(`${seed}: text score ${t} in "${s}" maps ${to.size} ways through steps ${steps}`);
    return ([...to][0]! / 100).toFixed(2);
  });
  const conv = (x: unknown, k: string | null, steps: number[]): unknown => {
    if (typeof x === "string") return str(x, steps);
    const f = fams.get(steps[0]);
    if (typeof x === "number" && k && x > 0 && x <= 1 && f && (AFF.has(k) || POP.has(k))) return (AFF.has(k) ? f.aff : f.pop).get(Math.round(x * 100))! / 100;
    if (Array.isArray(x)) return x.map((v) => conv(v, k, steps));
    if (x && typeof x === "object") {
      const own = (x as { steps?: unknown }).steps;
      return Object.fromEntries(Object.entries(x).map(([kk, v]) => [kk, conv(v, kk, Array.isArray(own) ? (own as number[]) : steps)]));
    }
    return x;
  };
  const demo = ev.map((e) => conv(e, null, "n" in e ? [(e as { n: number }).n] : [...fams.keys()])) as AskEvent[];
  const d1 = decisionEvent(demo);
  if (d0?.type !== "decision" || d1?.type !== "decision" || !d1.decision) throw new Error(`${seed}: no decision`);
  const c = checkDecision(d1.decision, stepsFrom(demo));
  if (!c.ok) throw new Error(`${seed}: the checker blocks the demo decision: ${c.problems.join("; ")}`);
  if (claimCount(d1.decision) !== claimCount(d0.decision!)) throw new Error(`${seed}: claim count changed`);
  out[nameMap.get((stepsFrom(ev).find((s) => s.tool === "resolve")!.output as { name: string }).name)!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")] = demo;
}
const dir = process.argv[3] ?? new URL("../lib/ask/demo/", import.meta.url).pathname;
for (const [slug, demo] of Object.entries(out)) writeFileSync(`${dir.replace(/\/$/, "")}/${slug}.json`, JSON.stringify(demo, null, 1) + "\n");
writeFileSync(process.argv[2] ?? "demo-world-map.json", JSON.stringify({ names: Object.fromEntries(nameMap), ids: Object.fromEntries(idMap) }, null, 1));
console.log(`wrote ${Object.keys(out).map((s) => `${s}.json`).join(", ")} in ${dir}; map in ${process.argv[2] ?? "demo-world-map.json"}`);
