// lib/ask/agent.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { finalize } from "./agent.ts";

test("no decision: the check fails with a plain reason, so the page shows steps only", () => {
  const r = finalize(null, []);
  assert.deepEqual(r, { decision: null, check: { ok: false, problems: ["The agent stopped before deciding."] } });
});

test("a decision is passed through the checker", () => {
  const steps = [{ n: 1, tool: "review", why: "", summary: "", output: { groups: [[{ name: "REI", affinity: 0.91 }]] } }];
  const r = finalize({ calls: [{ name: "REI", reason: "[[REI]] at 0.91.", steps: [1] }], cautions: [], summary: [] }, steps);
  assert.deepEqual(r.check, { ok: true });
});
