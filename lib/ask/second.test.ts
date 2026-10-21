// lib/ask/second.test.ts: the second look's tool, its outcome rule, and the loop with a scripted model (no API)
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { lookTools, outcomeOf, runLook, type LookEvent } from "./second.ts";
import type { AskEvent } from "./agent.ts";
import type { Entity } from "../qloo.ts";

const seed = { state: "confirmed", name: "Allbirds", id: "S", type: "urn:entity:brand" };
const cands = [{ name: "Bombas", id: "B" }, { name: "Parachute", id: "P" }, { name: "Warby Parker", id: "W" }];
const frozen: AskEvent[] = [
  { type: "call", n: 1, tool: "resolve", why: "" }, { type: "result", n: 1, summary: "Confirmed Allbirds", output: seed },
  { type: "call", n: 2, tool: "candidates", why: "" }, { type: "result", n: 2, summary: "3 candidates", output: { candidates: cands } },
  { type: "call", n: 3, tool: "review", why: "" },
  { type: "result", n: 3, summary: "No clear three", output: { method: { gap: 0.05 }, noClearThree: true, groups: [[{ name: "Bombas", affinity: 0.94 }, { name: "Warby Parker", affinity: 0.93 }, { name: "Parachute", affinity: 0.92 }]] } },
  { type: "decision", decision: { calls: [{ name: "Bombas", reason: "[[Bombas]] at 0.94.", steps: [3] }, { name: "Warby Parker", reason: "[[Warby Parker]] at 0.93.", steps: [3] }], cautions: [], summary: [] }, check: { ok: true } },
];
// Bombas fans rank Allbirds 1st, Warby Parker fans 9th, Parachute fans not at all
const lists: Record<string, string[]> = { B: ["S"], W: ["a", "b", "c", "d", "e", "f", "g", "h", "S"], P: ["x"] };
const get = async (p: Record<string, string | number>) => lists[p["signal.interests.entities"] as string].map((id) => ({ entity_id: id }) as Entity);

test("otherWay: the seed's rank among each candidate's fans, or not in their top 50; only candidate names", async () => {
  const rec: unknown[] = [];
  const t = lookTools(frozen.flatMap((e) => (e.type === "result" ? [{ n: e.n, tool: ["resolve", "candidates", "review"][e.n - 1], why: "", output: e.output, summary: e.summary }] : [])), get, (s) => rec.push(s));
  const out = await t.otherWay({ why: "w", names: ["[[Bombas]]", "Parachute", "Warby Parker"] }, 4);
  assert.deepEqual(out, { method: { topN: 50 }, seed: { name: "Allbirds" }, rows: [{ name: "Bombas", seedRankAmongTheirFans: 1 }, { name: "Parachute", seedRankAmongTheirFans: "not in their top 50" }, { name: "Warby Parker", seedRankAmongTheirFans: 9 }] });
  assert.deepEqual(await t.otherWay({ why: "w", names: ["Nike"] }, 5), { error: "otherWay only takes names from the candidates step" });
  assert.equal(rec.length, 2);
});

test("outcome: kept is same names in the same order; no calls is declined; a failed check is blocked", () => {
  const d = (names: string[]) => ({ decision: { calls: names.map((name) => ({ name, reason: "", steps: [1] })), cautions: [], summary: [] }, check: { ok: true as const } });
  assert.equal(outcomeOf(["A", "B"], d(["A", "B"])), "kept");
  assert.equal(outcomeOf(["A", "B"], d(["B", "A"])), "changed");
  assert.equal(outcomeOf(["A", "B"], d(["A"])), "changed");
  assert.equal(outcomeOf(["A", "B"], d([])), "declined");
  assert.equal(outcomeOf(["A"], { decision: d(["A"]).decision, check: { ok: false, problems: ["x"] } }), "blocked");
});

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
const turn = (i: number, toolName: string, input: object) => ({
  stream: simulateReadableStream({ chunks: [{ type: "stream-start" as const, warnings: [] }, { type: "tool-call" as const, toolCallId: `t${i}`, toolName, input: JSON.stringify(input) }, { type: "finish" as const, finishReason: { unified: "tool-calls" as const, raw: undefined }, usage }] }),
});
const look = async (turns: [string, object][]) => {
  const events: LookEvent[] = [];
  await runLook(frozen, get, (e) => events.push(e), new MockLanguageModelV4({ doStream: turns.map(([name, input], i) => turn(i, name, input)) }));
  return events;
};
const bad = { calls: [{ name: "Bombas", reason: "[[Bombas]] fans rank [[Allbirds]] 2.", steps: [4] }], cautions: [], summary: [] };
const good = { calls: [{ name: "Bombas", reason: "[[Bombas]] fans rank [[Allbirds]] 1.", steps: [4] }], cautions: [], summary: [] };

test("the loop: measures the other way, the checker's no comes back once as a check event, the fix passes", async () => {
  const ev = await look([["otherWay", { why: "The top three tied.", names: ["Bombas", "Parachute", "Warby Parker"] }], ["decide", bad], ["decide", good]]);
  assert.deepEqual(ev.map((e) => e.type), ["call", "result", "check", "decision", "look"]);
  assert.equal((ev[0] as { n: number }).n, 4); // new steps continue after the frozen ones
  assert.deepEqual((ev[2] as { problems: string[] }).problems, ["call 1: 2 isn't Bombas's own number", "call 1: 2 isn't in a cited step"]);
  assert.deepEqual((ev[3] as { check: unknown }).check, { ok: true });
  assert.deepEqual(ev[4], { type: "look", outcome: "changed", frozen: ["Bombas", "Warby Parker"], calls: ["Bombas"], measured: true, checkFed: true, citedLess: false });
});

test("AGENT-4: an answer that passes the second time only by dropping what it couldn't cite counts as cited less", async () => {
  const less = { calls: [{ name: "Bombas", reason: "[[Bombas]] fans rank [[Allbirds]] highest.", steps: [4] }], cautions: [], summary: [] };
  const ev = await look([["otherWay", { why: "Tied.", names: ["Bombas"] }], ["decide", bad], ["decide", less]]);
  assert.equal((ev.at(-1) as { citedLess: boolean }).citedLess, true);
});

test("decline is an answer, checked like any other; a second no ends the look as blocked", async () => {
  const declined = await look([["decline", { why: "Nothing separates them.", reason: { text: "[[Bombas]], [[Warby Parker]] and [[Parachute]] sit within one group.", steps: [3] } }]]);
  assert.deepEqual(declined.map((e) => e.type), ["decision", "look"]);
  assert.equal((declined.at(-1) as { outcome: string }).outcome, "declined");
  const ev = await look([["decline", { why: "x", reason: { text: "[[Nike]] is out.", steps: [3] } }], ["decide", bad]]);
  assert.equal((ev.at(-1) as { outcome: string }).outcome, "blocked");
});
