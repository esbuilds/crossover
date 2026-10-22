// The checker attack over the three recorded asks (W3, real Oct 24), offline: the same kinds scripts/mutation-gate.ts
// runs over the cache. One miss is published (a score nudged by 0.03, on Mt. Joy); the ceiling kind is counted apart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import allbirds from "./fixtures/allbirds.json" with { type: "json" };
import mtJoy from "./fixtures/mt-joy.json" with { type: "json" };
import liquidDeath from "./fixtures/liquid-death.json" with { type: "json" };
import { tamper, type Run } from "./tamper.ts";
import { decisionEvent, stepsFrom } from "./steps.ts";
import type { AskEvent } from "./agent.ts";

const run = (seed: string, ev: unknown): Run => {
  const events = ev as AskEvent[], d = decisionEvent(events);
  assert.ok(d && d.type === "decision" && d.check.ok && d.decision);
  return { seed, d: d.decision!, steps: stepsFrom(events) };
};

test("tamper: 20 of 21 gated copies rejected over the recorded asks; the ceiling kind 0 of 3", () => {
  const t = tamper([run("Allbirds", allbirds), run("Mt. Joy", mtJoy), run("Liquid Death", liquidDeath)]);
  assert.deepEqual(t.gated, { rejected: 20, of: 21 });
  const ceiling = t.kinds.filter((k) => !k.gated);
  assert.deepEqual(ceiling.map((k) => [k.rejected, k.applied]), [[0, 3]]);
  assert.deepEqual(t.kinds.flatMap((k) => (k.gated ? k.misses.map((m) => `${k.kind}: ${m.seed}`) : [])), ["score nudged by 0.03: Mt. Joy"]);
});

test("the Allbirds fixture is the frozen answer, byte for byte (docs/freeze.md)", () => {
  assert.equal(createHash("sha1").update(JSON.stringify(allbirds)).digest("hex"), "1db3003687a633fa32d4f348c16b5cfc7d67abb1");
});
