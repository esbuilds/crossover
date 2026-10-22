// Verify it with no keys (W3, real Oct 24): no API key, no Redis, no network. Reads the three recorded asks in
// lib/ask/fixtures/ and the committed audit files, and exits 1 if anything differs from what's stated here.
//   npm run verify
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { claimCount, CHECK_RULE } from "../lib/ask/check.ts";
import { decisionEvent, stepsFrom } from "../lib/ask/steps.ts";
import { tamper, type Run } from "../lib/ask/tamper.ts";
import type { AskEvent } from "../lib/ask/agent.ts";
import allbirds from "../lib/ask/fixtures/allbirds.json" with { type: "json" };
import mtJoy from "../lib/ask/fixtures/mt-joy.json" with { type: "json" };
import liquidDeath from "../lib/ask/fixtures/liquid-death.json" with { type: "json" };
import control from "../audit/replay-control.json" with { type: "json" };
import reverse from "../audit/replay-reverse.json" with { type: "json" };

// what this run must reproduce (measured real Oct 24 at rule v3.1); the frozen hashes come from docs/freeze.md itself
const EXPECT = { claims: { Allbirds: 31, "Mt. Joy": 33, "Liquid Death": 27 } as Record<string, number>, gated: [20, 21], ceiling: [0, 3], control: [17, 17], reverse: [5, 3] };
let bad = 0;
const fail = (why: string) => { bad++; console.log(`  MISMATCH: ${why}`); };

const freeze = readFileSync(new URL("../docs/freeze.md", import.meta.url), "utf8");
const frozen = (label: string) => new RegExp(`^\\| ${label} \\| ([0-9a-f]{40}) \\|`, "m").exec(freeze)?.[1] ?? null;

console.log("1. The recorded asks against the freeze table (docs/freeze.md)");
const asks: [string, AskEvent[]][] = [["Allbirds", allbirds as unknown as AskEvent[]], ["Mt. Joy", mtJoy as unknown as AskEvent[]], ["Liquid Death", liquidDeath as unknown as AskEvent[]]];
for (const [label, events] of asks) {
  const sha = createHash("sha1").update(JSON.stringify(events)).digest("hex"), f = frozen(label.replace(".", "\\."));
  console.log(`   ${label.padEnd(13)} ${sha}  ${f === null ? "(a recorded ask, not in the freeze table)" : f === sha ? "= frozen" : `frozen ${f}`}`);
  if (f !== null && f !== sha) fail(`${label} hash`);
}
console.log("   The Coca-Cola x Converse replay ask has no fixture; scripts/ask-hashes.ts checks it from the cache.");

console.log(`\n2. The checker, rule ${CHECK_RULE}, on each recorded decision`);
const runs: Run[] = [];
for (const [label, events] of asks) {
  const d = decisionEvent(events), steps = stepsFrom(events);
  const ok = !!(d && d.type === "decision" && d.check.ok && d.decision);
  const n = ok && d.type === "decision" ? claimCount(d.decision!) : 0;
  console.log(`   ${label.padEnd(13)} ${ok ? "ok" : "blocked"}, ${n} names and numbers matched to a cited step`);
  if (!ok || n !== EXPECT.claims[label]) fail(`${label} verdict`);
  if (ok && d.type === "decision") runs.push({ seed: (steps.find((s) => s.tool === "resolve")?.output as { name?: string })?.name ?? label, d: d.decision!, steps });
}

console.log("\n3. The checker attack's tampers over these answers (the full attack over every cached answer reads the cache: scripts/mutation-gate.ts)");
const t = tamper(runs);
for (const k of t.kinds) console.log(`   ${k.gated ? " " : "*"} ${k.kind}: ${k.rejected} of ${k.applied} rejected${k.misses.length ? `; passed: ${k.misses.map((m) => m.seed).join(", ")}` : ""}`);
const ceiling = t.kinds.filter((k) => !k.gated).reduce((a, k) => [a[0] + k.rejected, a[1] + k.applied], [0, 0]);
console.log(`   Gated kinds: ${t.gated.rejected} of ${t.gated.of} rejected. * The documented ceiling: ${ceiling[0]} of ${ceiling[1]}.`);
if (t.gated.rejected !== EXPECT.gated[0] || t.gated.of !== EXPECT.gated[1]) fail("gated tampers");
if (ceiling[0] !== EXPECT.ceiling[0] || ceiling[1] !== EXPECT.ceiling[1]) fail("ceiling tampers");

console.log("\n4. The replay controls, recounted from their cases");
const hits = (xs: (number | null)[]) => xs.filter((r) => r !== null && r <= 3).length;
const c = [hits(control.cases.map((x) => x.realRank)), hits(control.cases.map((x) => x.scrambledRank))];
const r = [reverse.cases.filter((x) => x.realHit).length, reverse.cases.filter((x) => x.scrambledHit).length];
console.log(`   audit/replay-control.json: real partner in the top three ${c[0]} of ${control.cases.length}, with the seed scrambled ${c[1]} of ${control.cases.length}`);
console.log(`   audit/replay-reverse.json: ranked the other way, ${r[0]} of ${reverse.cases.length} against ${r[1]} scrambled`);
if (c.join() !== EXPECT.control.join() || c.join() !== [control.summary.realHits, control.summary.scrambledHits].join()) fail("control recount");
if (r.join() !== EXPECT.reverse.join() || r.join() !== [reverse.summary.realHits, reverse.summary.scrambledHits].join()) fail("reverse recount");

console.log(bad ? `\n${bad} mismatch${bad === 1 ? "" : "es"}` : "\nAll match.");
process.exitCode = bad ? 1 : 0;
