// lib/ask/tools.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTools, type Deps } from "./tools.ts";
import type { StepRecord } from "./check.ts";
import type { Entity } from "../qloo.ts";

const B = "urn:entity:brand";
const ent = (id: string): Entity => ({ entity_id: id, name: id, types: [B], popularity: 0.9, akas: [], tags: [] });
const base: Deps = {
  identify: async (q) => (q.query === "Dove" ? { state: "ambiguous", input: "Dove", options: [{ entity_id: "D1", name: "Dove", type: B, popularity: 1, tags: [] }, { entity_id: "D2", name: "Dove", type: "urn:entity:movie", popularity: 0.5, tags: [] }] }
    : q.query === "Fruition" ? { state: "unresolved", input: "Fruition" }
    : { state: "confirmed", input: "Liquid Death", entity: { entity_id: "LD", name: "Liquid Death", type: B, popularity: 0.9, tags: [] }, via: "exact name" }),
  card: async (id) => ent(id),
  rival: async () => ({ kind: "pick", field: "category", category: "drinks", pick: { id: "CEL", name: "Celsius", type: B, affinity: 0.7 }, alternates: [], competitors: [] }),
  vs: async () => null,
  top50: async () => Array.from({ length: 10 }, (_, i) => ent(`T${i}`)),
  cards: async (ids) => ids.map(ent),
  review: async () => { throw new Error("not in this test"); },
  twins: async () => null,
};

test("resolve: ambiguous returns the options and records a step", async () => {
  const steps: StepRecord[] = [];
  const t = makeTools(base, (s) => steps.push(s));
  const r = await t.resolve({ why: "Find the brand.", name: "Dove" });
  assert.equal((r.output as { state: string }).state, "ambiguous");
  assert.deepEqual((r.output as { options: { name: string }[] }).options.map((o) => o.name), ["Dove", "Dove"]);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].why, "Find the brand.");
});

test("resolve: unresolved says so; later tools refuse without a seed", async () => {
  const t = makeTools(base, () => {});
  assert.equal(((await t.resolve({ why: "x", name: "Fruition" })).output as { state: string }).state, "unresolved");
  assert.match(((await t.findRival({ why: "x" })).output as { error: string }).error, /resolve/);
});

test("candidates from top50, then review refuses ids that candidates didn't return", async () => {
  const t = makeTools(base, () => {});
  await t.resolve({ why: "x", name: "Liquid Death" });
  const c = await t.candidates({ why: "x", source: "top50" });
  assert.equal((c.output as { candidates: unknown[] }).candidates.length, 8);
  const r = await t.review({ why: "x", ids: ["T0", "NOT_A_CANDIDATE"] });
  assert.match((r.output as { error: string }).error, /candidates/);
});

test("split needs a rival first", async () => {
  const t = makeTools(base, () => {});
  await t.resolve({ why: "x", name: "Liquid Death" });
  assert.match(((await t.split({ why: "x" })).output as { error: string }).error, /findRival/);
});
