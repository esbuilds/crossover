// Both ways (Fable's columns ruling, real Oct 15): the frozen Allbirds and Mt. Joy answers against a recorded getter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bothWaysFrom, gate, sentence, type Row } from "./both-ways.ts";
import allbirds from "./fixtures/allbirds.json" with { type: "json" };
import mtJoy from "./fixtures/mt-joy.json" with { type: "json" };
import { firstCallHeading, oneWay } from "./both-rules.ts";
import type { AskEvent } from "./agent.ts";

// Allbirds' rank among each candidate's fans' brands, as scripts/reverse-probe.ts measured it (0 = not in their top 50)
const REV: Record<string, number> = { Bombas: 1, "Warby Parker": 11, ClassPass: 16, Parachute: 31, "Tuft & Needle": 9, "Felix Gray": 12, Quince: 30, Summersalt: 0 };
const SEED = "78A44C09-E691-42DA-A553-5CDE6EE9B18A";
const events = allbirds as unknown as AskEvent[];
const cands = (events.find((e) => (e as { output?: { candidates?: unknown } }).output?.candidates) as unknown as { output: { candidates: { name: string; id: string }[] } }).output.candidates;

const recorded = (seen: Record<string, string | number>[] = []) => async (p: Record<string, string | number>) => {
  seen.push(p);
  const name = cands.find((c) => c.id === p["signal.interests.entities"])!.name;
  const at = REV[name];
  return Array.from({ length: 50 }, (_, i) => ({ entity_id: i + 1 === at ? SEED : `x${i}`, name: "x" })) as never;
};

test("Allbirds: eight rows in the frozen review's order, every rank from a recorded request, the three marked", async () => {
  const seen: Record<string, string | number>[] = [];
  const b = (await bothWaysFrom(events, recorded(seen)))!;
  assert.deepEqual(b.rows.map((r) => r.name), ["Bombas", "Warby Parker", "ClassPass", "Parachute", "Tuft & Needle", "Felix Gray", "Quince", "Summersalt"]);
  assert.deepEqual(b.rows.map((r) => r.fwd), [2, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(b.rows.map((r) => r.rev), [1, 11, 16, 31, 9, 12, 30, "out"]);
  assert.deepEqual(b.rows.filter((r) => r.call).map((r) => r.name), ["Bombas", "Warby Parker", "ClassPass"]);
  assert.equal(seen.length, 8);
  assert.ok(seen.every((p) => p["filter.type"] === "urn:entity:brand" && p.take === 50));
  assert.equal(b.sentence, "Bombas fans rank Allbirds first among brands.");
});

const row = (name: string, rev: Row["rev"], call = false): Row => ({ name, fwd: null, rev, call });

test("the sentence prints only at reverse rank 1 to 3, and never names a decision", () => {
  assert.equal(sentence("Mt. Joy", "artists", row("Outdoor Voices", 26, true)), null);
  assert.equal(sentence("Mt. Joy", "artists", row("Outdoor Voices", "out", true)), null);
  assert.equal(sentence("Allbirds", "brands", row("Bombas", 3, true)), "Bombas fans rank Allbirds third among brands.");
  assert.ok(!/call|should/i.test(sentence("Allbirds", "brands", row("Bombas", 1, true))!));
});

test("gate: no block when the three don't separate (the Converse case: all outside the top 50)", () => {
  assert.equal(gate([row("Converse", "out", true), row("Vans", "out", true), row("HUF", "out")]), false);
  assert.equal(gate([row("A", 1, true), row("B", 3, true), row("C", 4)]), false); // spread under 5
  assert.equal(gate([row("A", 1, true), row("B", 11, true), row("C", 9)]), true);
});

// The heading follows the measurement (Fable's persona round 2 ruling, Eric approved Oct 15), on the frozen fixtures.
const MJ_REV: Record<string, number> = { "Outdoor Voices": 26, Allbirds: 4, Alternative: 0, "Felix Gray": 0, "LaCroix Sparkling Water": 28, Summersalt: 0, "Marine Layer": 0, "Carve Designs": 0 };
const MJ = "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A";

test("heading: Allbirds keeps 'Call first' (Bombas fans rank it 1st); Mt. Joy and no table read 'The agent's first call'", async () => {
  const ab = (await bothWaysFrom(events, recorded()))!;
  assert.equal(firstCallHeading(ab, "Bombas"), "Call first: Bombas");
  const mjEvents = mtJoy as unknown as AskEvent[];
  const mjCands = (mjEvents.find((e) => (e as { output?: { candidates?: unknown } }).output?.candidates) as unknown as { output: { candidates: { name: string; id: string }[] } }).output.candidates;
  const mj = (await bothWaysFrom(mjEvents, async (p) => Array.from({ length: 50 }, (_, i) => ({ entity_id: i + 1 === MJ_REV[mjCands.find((c) => c.id === p["signal.interests.entities"])!.name] ? MJ : `x${i}`, name: "x" })) as never))!;
  assert.equal(mj.shown, true);
  assert.equal(firstCallHeading(mj, "Outdoor Voices"), "The agent's first call: Outdoor Voices");
  assert.equal(mj.sentence, null);
  assert.equal(mj.oneWay, null); // 26th is inside the 50: neither sentence
  assert.equal(firstCallHeading(null, "Converse"), "The agent's first call: Converse");
  assert.equal(firstCallHeading({ ...ab, shown: false }, "Bombas"), "The agent's first call: Bombas");
});

test("one-way line: the first call's fans don't have the seed in their top 50; names the highest reverse rank", () => {
  const r = (name: string, rev: number | "out", call = false) => ({ name, fwd: null, rev, call });
  const rows = [r("Shinesty", "out", true), r("Chubbies", 18, true), r("Birddogs", 9)];
  assert.equal(oneWay("Tyler Childers", "artists", rows, rows[0]), "Shinesty fans don't have Tyler Childers in their top 50 artists; the pull runs one way. Birddogs fans rank Tyler Childers 9th, the highest of the eight.");
  assert.equal(oneWay("Allbirds", "brands", [r("Bombas", 1, true)], r("Bombas", 1, true)), null);
});
