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

test("split names both sides in its output, so sentences citing it can name the rival", async () => {
  const vs = { rivals: { a: { name: "Liquid Death" }, b: { name: "Celsius" }, leansA: [], leansB: [], shared: [], sameField: [] }, map: null } as unknown as NonNullable<Awaited<ReturnType<Deps["vs"]>>>;
  const t = makeTools({ ...base, vs: async () => vs }, () => {});
  await t.resolve({ why: "x", name: "Liquid Death" });
  await t.findRival({ why: "x" });
  const out = (await t.split({ why: "x" })).output as { seed: { name: string }; rival: { name: string } };
  assert.deepEqual([out.seed.name, out.rival.name], ["Liquid Death", "Celsius"]);
});

// Found warming Olipop and Mt. Joy (Oct 13): sentences quoting the method's own numbers (the 0.05 gap, top 50) failed
// the check because no output stated them. The outputs now carry them.
test("split and candidates state the method numbers they use (top 50, the 0.05 gap)", async () => {
  const vs = { rivals: { a: { name: "Liquid Death" }, b: { name: "Celsius" }, leansA: [], leansB: [], shared: [], sameField: [] }, map: null } as unknown as NonNullable<Awaited<ReturnType<Deps["vs"]>>>;
  const t = makeTools({ ...base, vs: async () => vs }, () => {});
  await t.resolve({ why: "x", name: "Liquid Death" });
  await t.findRival({ why: "x" });
  const s = (await t.split({ why: "x" })).output as { method: { topN: number; gap: number } };
  assert.deepEqual(s.method, { topN: 50, gap: 0.05 });
  const c = (await t.candidates({ why: "x", source: "top50" })).output as { method: { topN: number } };
  assert.equal(c.method.topN, 50);
});

// Final review, Important 1: two tool calls in one turn run concurrently; a refusal that finishes first must keep the
// number the guard gave it, or the page and the checker read the wrong step.
test("steps keep the number the guard assigned, even when a refusal finishes first", async () => {
  const steps: StepRecord[] = [];
  const t = makeTools(base, (s) => steps.push(s));
  await t.resolve({ why: "x", name: "Liquid Death" }, 1);
  await Promise.all([t.candidates({ why: "x", source: "top50" }, 2), t.twins({ why: "x" }, 3)]);
  assert.deepEqual(steps.map((s) => `${s.n} ${s.tool}`).sort(), ["1 resolve", "2 candidates", "3 twins"]);
});

// Final review, Important 3: the model names the unknown query and counts the options; both must be in the output.
test("unresolved names the query under name; ambiguous states its count", async () => {
  const t = makeTools(base, () => {});
  assert.equal(((await t.resolve({ why: "x", name: "Fruition" })).output as { name: string }).name, "Fruition");
  assert.equal(((await t.resolve({ why: "x", name: "Dove" })).output as { count: number }).count, 2);
});

// Deferred minor fixed Oct 13: no cards back for the candidate ids must refuse, not crash the run.
test("review refuses when Qloo returns no cards for the candidates", async () => {
  const t = makeTools({ ...base, cards: async () => [] }, () => {});
  await t.resolve({ why: "x", name: "Liquid Death" });
  await t.candidates({ why: "x", source: "top50" });
  const r = await t.review({ why: "x", ids: ["T0", "T1"] });
  assert.match((r.output as { error: string }).error, /no cards|couldn't/);
});
