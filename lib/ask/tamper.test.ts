// The checker attack over the three demo asks (W3, real Oct 24; the demo world W2, real Oct 25), offline: the same kinds
// scripts/mutation-gate.ts runs over the cache. The demo keeps the recorded asks' one miss (a score nudged by 0.03, on
// the artist ask); the ceiling kind is counted apart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import corvid from "./demo/corvid-co.json" with { type: "json" };
import tideChoir from "./demo/low-tide-choir.json" with { type: "json" };
import calder from "./demo/calder-shoe.json" with { type: "json" };
import { tamper, type Run } from "./tamper.ts";
import { decisionEvent, stepsFrom } from "./steps.ts";
import type { AskEvent } from "./agent.ts";

const run = (seed: string, ev: unknown): Run => {
  const events = ev as AskEvent[], d = decisionEvent(events);
  assert.ok(d && d.type === "decision" && d.check.ok && d.decision);
  return { seed, d: d.decision!, steps: stepsFrom(events) };
};

test("tamper: 20 of 21 gated copies rejected over the demo asks; the ceiling kind 0 of 3", () => {
  const t = tamper([run("Corvid & Co.", corvid), run("Low Tide Choir", tideChoir), run("Calder Shoe", calder)]);
  assert.deepEqual(t.gated, { rejected: 20, of: 21 });
  const ceiling = t.kinds.filter((k) => !k.gated);
  assert.deepEqual(ceiling.map((k) => [k.rejected, k.applied]), [[0, 3]]);
  assert.deepEqual(t.kinds.flatMap((k) => (k.gated ? k.misses.map((m) => `${k.kind}: ${m.seed}`) : [])), ["score nudged by 0.03: Low Tide Choir"]);
});

// The recorded asks are Qloo data, so they stay out of the public repo; where they're present this pins the frozen hash.
const recorded = new URL("./fixtures/allbirds.json", import.meta.url);
test("the recorded Allbirds ask is the frozen answer, byte for byte (docs/freeze.md)", { skip: !existsSync(recorded) && "the recorded asks are kept private" }, () => {
  assert.equal(createHash("sha1").update(JSON.stringify(JSON.parse(readFileSync(recorded, "utf8")))).digest("hex"), "1db3003687a633fa32d4f348c16b5cfc7d67abb1");
});
