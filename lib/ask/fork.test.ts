// The fork line (the destroy brief 2d, real Oct 15): only where the path branches, from the step's own output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { forkLine } from "./steps.ts";

const step = (tool: string, output: unknown) => ({ n: 1, tool, why: "", summary: "", output }) as never;

test("forkLine: resolve and findRival branch; the other steps get no line", () => {
  assert.match(forkLine(step("resolve", { state: "confirmed" }))!, /went on/);
  assert.equal(forkLine(step("resolve", { state: "ambiguous" })), null);
  assert.match(forkLine(step("findRival", { found: false }))!, /no rival/);
  assert.doesNotMatch(forkLine(step("findRival", { found: true, by: "genre tag" }))!, /category/);
  assert.match(forkLine(step("findRival", { found: true, by: "Qloo category soft drinks" }))!, /product category \(soft drinks\)/);
  for (const t of ["split", "candidates", "review", "twins"]) assert.equal(forkLine(step(t, { found: true })), null);
});
