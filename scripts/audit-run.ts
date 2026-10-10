// The frozen audit (audit/briefs.json, audit-v1): held-out briefs through /api/review exactly as a visitor's request
// would run, and the resolution challenges through the route's own resolve path. Serial, never parallel.
// Raw responses go to <outDir> (outside the repo: Qloo output stays out of git); audit/results.json gets derived
// numbers only (names, two-decimal affinity, groups, picks, states) for the /audit page.
//
//   QLOO_DAILY_CAP=<counter + hard stop> node --env-file=.env.local scripts/audit-run.ts <baseUrl> <outDir> [--skip-run]
//   --skip-run rebuilds audit/results.json from <outDir> without any calls.
//   --recheck re-reads the resolution challenges and the seed names under the current identity rule (searches are
//   cached by then, so it should spend nothing; the call count at the end says).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { search, RESOLVE_TYPES, qlooCallCount, type Entity } from "../lib/qloo.ts";
import { resolve } from "../lib/resolve.ts";
import { fixtureByQuery } from "../lib/fixtures.ts";
import { identityOf, REVIEW_VERSION, type Identity, type Review } from "../lib/review.ts";

const [base, out, ...rest] = process.argv.slice(2);
if (!base || !out) throw new Error("usage: scripts/audit-run.ts <baseUrl> <outDir> [--skip-run]");
const RUN = !rest.includes("--skip-run");
const RECHECK = rest.includes("--recheck");
const audit = JSON.parse(readFileSync("audit/briefs.json", "utf8"));
type Brief = { seed: string; set: "dev" | "heldOut"; candidates: { name: string; role: string; note?: string }[]; buyer: Record<string, unknown> };
const briefs: Brief[] = audit.briefs;

async function usage() {
  return (await (await fetch(`${base}/api/usage`)).json()) as { today: number; cap: number | null };
}

// 1. held-out briefs, through the route
if (RUN) {
  for (const b of briefs.filter((x) => x.set === "heldOut")) {
    const before = (await usage()).today;
    const res = await fetch(`${base}/api/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seed: b.seed, names: b.candidates.map((c) => c.name), buyer: b.buyer, only: "brand" }),
    });
    const body = await res.json();
    writeFileSync(`${out}/${b.seed}.json`, JSON.stringify(body, null, 2));
    console.log(`${b.seed}: HTTP ${res.status}, ${(await usage()).today - before} calls`);
    if (!res.ok) throw new Error(`${b.seed} failed: ${JSON.stringify(body).slice(0, 300)}`); // stop: never retry blind
  }
}

// 2. resolution challenges: what a typed name becomes (all five types, as for a seed)
type Challenge = { q: string; kind: string; expect: string };
// The entity a confirmation must land on to count as right. null: any confirmation is wrong.
const RIGHT: Record<string, { name: RegExp; type?: string } | null> = {
  Dove: { name: /^dove$/i, type: "urn:entity:brand" },
  Corona: { name: /^corona( extra)?$/i, type: "urn:entity:brand" },
  Delta: { name: /^delta air lines$/i, type: "urn:entity:brand" },
  Mars: { name: /^mars( inc.*| incorporated)?$/i, type: "urn:entity:brand" },
  Ghost: null,
  Prime: null,
  "Liquid Deth": { name: /^liquid death$/i },
  "Olli Pop": { name: /^olipop$/i },
  "Dr Squach": { name: /^dr\.? squatch/i },
  Hydroflask: { name: /^hydro ?flask$/i },
  "Lulu Lemon": { name: /^lululemon/i },
  "Trader Joes": { name: /^trader joe'?s$/i },
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
type Outcome = { q: string; kind: string; expect: string; state: Identity["state"]; shown: string[]; neverWrong: boolean; asExpected: boolean };

async function challenge(c: Challenge): Promise<Outcome> {
  const fx = fixtureByQuery(c.q);
  const id = identityOf(c.q, fx ? fx.resolution : await resolve(c.q, (await search(c.q, RESOLVE_TYPES, 5)) as Entity[]));
  const shown = id.state === "confirmed" ? [id.entity.name] : id.state === "ambiguous" ? id.options.map((o) => o.name) : [];
  const right = c.kind === "obscure" ? { name: new RegExp(`^${norm(c.q)}$`), type: "urn:entity:brand" } : c.kind === "nonexistent" ? null : RIGHT[c.q];
  const hit = (name: string, type: string) => !!right && right.name.test(c.kind === "obscure" ? norm(name) : name) && (!right.type || right.type === type);
  const neverWrong = id.state !== "confirmed" || hit(id.entity.name, id.entity.type);
  const asExpected =
    c.kind === "nonexistent" ? id.state === "unresolved"
    : c.kind === "near-miss" && c.q === "Trader Joes" ? id.state === "confirmed" && neverWrong
    : c.kind === "near-miss" ? id.state === "unresolved" || (id.state === "ambiguous" && id.options.some((o) => hit(o.name, o.type))) || (id.state === "confirmed" && neverWrong)
    : RIGHT[c.q] === null ? id.state === "ambiguous"
    : neverWrong;
  return { q: c.q, kind: c.kind, expect: c.expect, state: id.state, shown, neverWrong, asExpected };
}

const resFile = `${out}/resolution.json`;
let resolution: Outcome[] = existsSync(resFile) ? JSON.parse(readFileSync(resFile, "utf8")) : [];
if (RUN) {
  resolution = [];
  for (const c of audit.resolution.challenges as Challenge[]) resolution.push(await challenge(c));
  writeFileSync(resFile, JSON.stringify(resolution, null, 2));
}

// 2b. the same challenges under the current rule, kept next to the as-run result, plus the seeds as typed
const recheckFile = `${out}/resolution-recheck.json`;
let recheck: { rule: string; challenges: Outcome[]; seeds: { q: string; state: string; shown: string[] }[] } | null = existsSync(recheckFile) ? JSON.parse(readFileSync(recheckFile, "utf8")) : null;
if (RECHECK) {
  const challenges: Outcome[] = [];
  for (const c of audit.resolution.challenges as Challenge[]) challenges.push(await challenge(c));
  const seeds = [];
  for (const b of briefs) {
    const fx = fixtureByQuery(b.seed);
    const id = identityOf(b.seed, fx ? fx.resolution : await resolve(b.seed, (await search(b.seed, RESOLVE_TYPES, 5)) as Entity[]));
    seeds.push({ q: b.seed, state: id.state, shown: id.state === "confirmed" ? [id.entity.name] : id.state === "ambiguous" ? id.options.map((o) => `${o.name} (${o.type.replace("urn:entity:", "")})`) : [] });
  }
  recheck = { rule: REVIEW_VERSION, challenges, seeds };
  writeFileSync(recheckFile, JSON.stringify(recheck, null, 2));
}

// 3. derived results for the page
const two = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
function derive(b: Brief, r: Review) {
  const g = r.groups.find((x) => x.type === "urn:entity:brand") ?? r.groups[0];
  const byId = new Map(g?.rows.map((row) => [row.entity.entity_id, row]) ?? []);
  const label = (id: string) => byId.get(id)!.input;
  const role = (input: string) => b.candidates.find((c) => c.name === input)?.role ?? null;
  return {
    seed: b.seed,
    set: b.set,
    picks: g ? g.selection.picks.map(label) : [],
    noClearThree: g?.selection.noClearThree ?? false,
    tiedAtCutoff: g ? g.selection.tiedAtCutoff.map(label) : [],
    groups: g ? g.affinityBands.map((band) => band.map((id) => ({ name: label(id), matched: byId.get(id)!.entity.name, affinity: two(byId.get(id)!.forward.value), popularity: two(byId.get(id)!.popularity), role: role(label(id)) }))) : [],
    popularityBands: g ? g.popularityBands.map((band) => band.map(label)) : [],
    excluded: g ? g.rows.filter((row) => row.gate.state === "excluded").map((row) => ({ name: row.input, reason: row.gate.state === "excluded" ? row.gate.reason : "" })) : [],
    notMeasured: r.notMeasured.map((i) => ({ name: i.input, state: i.state, role: role(i.input) })),
    otherTypes: r.groups.filter((x) => x !== g).map((x) => ({ type: x.type, names: x.rows.map((row) => row.input) })),
  };
}
const fileFor = (b: Brief) => (b.set === "dev" ? `${out}/${b.seed}.v2.json` : `${out}/${b.seed}.json`);
const results = {
  protocol: audit.version,
  rules: "review-v2",
  ranAt: new Date().toISOString().slice(0, 10),
  briefs: briefs.filter((b) => existsSync(fileFor(b))).map((b) => derive(b, JSON.parse(readFileSync(fileFor(b), "utf8")))),
  resolution: { rule: "review-v2", challenges: resolution },
  resolutionRecheck: recheck && { rule: recheck.rule, challenges: recheck.challenges },
};
writeFileSync("audit/results.json", JSON.stringify(results, null, 2) + "\n");

for (const b of results.briefs.filter((x) => x.set === "heldOut")) {
  console.log(`\n${b.seed}: picks ${b.picks.join(", ") || "none"}${b.noClearThree ? " [no clear three]" : ""}; tied ${b.tiedAtCutoff.join(", ") || "none"}`);
  console.log("  " + b.groups.map((grp) => grp.map((x) => `${x.name}${x.matched !== x.name ? ` (${x.matched})` : ""} ${x.affinity}`).join(" / ")).join("  |  "));
  if (b.excluded.length) console.log("  excluded: " + b.excluded.map((x) => `${x.name} (${x.reason})`).join(", "));
  console.log("  not measured: " + (b.notMeasured.map((x) => `${x.name} ${x.state}`).join(", ") || "none"));
}
console.log(`\nresolution: never wrong ${resolution.filter((x) => x.neverWrong).length}/${resolution.length}, as expected ${resolution.filter((x) => x.asExpected).length}/${resolution.length}`);
for (const x of resolution) console.log(`  ${x.neverWrong ? "ok " : "BAD"} ${x.asExpected ? "=" : "~"} ${x.q} -> ${x.state} ${x.shown.slice(0, 3).join(" | ")}`);
if (recheck) {
  const c = recheck.challenges;
  console.log(`\nrecheck (${recheck.rule}): never wrong ${c.filter((x) => x.neverWrong).length}/${c.length}, as expected ${c.filter((x) => x.asExpected).length}/${c.length}`);
  for (const x of c.filter((y) => !y.neverWrong || !y.asExpected || ["Corona", "Mars", "Ghost", "Prime", "Dove"].includes(y.q))) console.log(`  ${x.neverWrong ? "ok " : "BAD"} ${x.asExpected ? "=" : "~"} ${x.q} -> ${x.state} ${x.shown.join(" | ")}`);
  console.log("  seeds: " + recheck.seeds.map((x) => `${x.q} ${x.state}${x.state !== "confirmed" ? ` [${x.shown.join(" | ")}]` : ""}`).join(", "));
}
console.log(`\nQloo calls in this process: ${qlooCallCount()}`);
