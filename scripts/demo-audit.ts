// Stand-ins for the six audit tables the build imports. The real ones are Qloo data, which Qloo's
// hackathon guide keeps out of public repos, so the public mirror swaps audit/demo/<file>.json in at audit/<file>.json:
// the same keys and types so /audit and /replay build, but every name invented, every id fresh, and every score and
// rank drawn at random, marked "demo": true. Counts, years, enums and links stay. Pages show a notice on these, and the
// tests and verify steps that recount the real audit skip.
//   node --disable-warning=ExperimentalWarning scripts/demo-audit.ts
import { randomInt, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FILES = ["results", "replay", "replay-v2", "replay-control", "replay-reverse", "popularity-fair"];
const NAME_KEYS = new Set(["seed", "partner", "name", "scrambledSeed", "picks", "tiedAtCutoff", "popularityBands"]);
const RANK_KEYS = new Set(["rank", "popularityRank", "realRank", "scrambledRank", "forwardRank", "storedPopularityRank", "affinityRank"]);
const SEED_RANK_KEYS = new Set(["seed", "scrambledSeed"]); // replay-reverse: the seed's rank in a top-50 list
const UUID = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/gi;
const TEXT_SCORE = /(?<![\w.])0\.\d\d(?!\d)/g;
const SYL = ["ba", "ke", "lo", "mi", "nu", "ra", "so", "ti", "vo", "ze", "dar", "fen", "gol", "hap", "jor", "kel", "mup", "nob", "pell", "quin", "rost", "sev", "tam", "vex", "wim"];

const read = (f: string) => JSON.parse(readFileSync(new URL(`../audit/${f}.json`, import.meta.url), "utf8"));
const walk = (x: unknown, f: (k: string | null, v: unknown) => void, k: string | null = null): void => {
  f(k, x);
  if (Array.isArray(x)) x.forEach((v) => walk(v, f, k));
  else if (x && typeof x === "object") for (const [kk, v] of Object.entries(x)) walk(v, f, kk);
};
const names = new Set<string>();
for (const f of FILES) walk(read(f), (k, v) => { if (k && NAME_KEYS.has(k) && typeof v === "string" && v.trim()) names.add(v); });
const used = new Set<string>();
const word = () => { const w = Array.from({ length: 2 + randomInt(2) }, () => SYL[randomInt(SYL.length)]).join(""); return w[0].toUpperCase() + w.slice(1); };
const invent = () => { let n = ""; while (!n || used.has(n)) n = randomInt(3) ? word() : `${word()} ${word()}`; used.add(n); return n; };
const nameMap = new Map([...names].map((n) => [n, invent()]));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NAMES = new RegExp(`(?<![\\w])(${[...nameMap.keys()].sort((a, b) => b.length - a.length).map(esc).join("|")})(?![\\w])`, "g");
const ids = new Map<string, string>();
const id = (s: string) => ids.get(s.toUpperCase()) ?? (ids.set(s.toUpperCase(), randomUUID().toUpperCase()), ids.get(s.toUpperCase())!);
const str = (s: string) => s.replace(NAMES, (n) => nameMap.get(n)!).replace(UUID, id).replace(TEXT_SCORE, (t) => (t === "0.05" ? t : (randomInt(40, 100) / 100).toFixed(2)));

const conv = (x: unknown, k: string | null): unknown => {
  if (typeof x === "string") return str(x);
  if (typeof x === "number" && k && RANK_KEYS.has(k)) return randomInt(1, 9);
  if (typeof x === "number" && k && SEED_RANK_KEYS.has(k)) return randomInt(1, 51);
  if (typeof x === "number" && x > 0 && x < 1) return randomInt(1, 100) / 100; // a score, popularity or heatmap cell
  if (Array.isArray(x)) return x.map((v) => conv(v, k));
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([kk, v]) => [str(kk), conv(v, kk)]));
  return x;
};
mkdirSync(new URL("../audit/demo/", import.meta.url), { recursive: true });
for (const f of FILES) writeFileSync(new URL(`../audit/demo/${f}.json`, import.meta.url), JSON.stringify({ demo: true, ...(conv(read(f), null) as object) }, null, 1) + "\n");
console.log(`audit/demo/: ${FILES.length} stand-ins, ${nameMap.size} names invented, ${ids.size} ids fresh`);
