// Both ways (Fable's columns ruling, real Oct 15): the frozen Allbirds and Mt. Joy answers against a recorded getter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bothWaysFrom, gate, sentence, type Row } from "./both-ways.ts";
import allbirds from "./fixtures/allbirds.json" with { type: "json" };
import mtJoy from "./fixtures/mt-joy.json" with { type: "json" };
import { bothLine, cell, firstCallHeading, firstCallWhy, leftSub, oneWay, OUT_LINES, rightSub, slope, type BothWays } from "./both-rules.ts";
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

// The card line and the slopegraph (COLDJUDGE-8, SPECTACLE-2, real Oct 22): every rank either prints is a table cell.
const mjBoth = async () => {
  const mjEvents = mtJoy as unknown as AskEvent[];
  const mjCands = (mjEvents.find((e) => (e as { output?: { candidates?: unknown } }).output?.candidates) as unknown as { output: { candidates: { name: string; id: string }[] } }).output.candidates;
  return (await bothWaysFrom(mjEvents, async (p) => Array.from({ length: 50 }, (_, i) => ({ entity_id: i + 1 === MJ_REV[mjCands.find((c) => c.id === p["signal.interests.entities"])!.name] ? MJ : `x${i}`, name: "x" })) as never))!;
};

test("card line: the first call's reverse rank, then the other seven's range, from the rows only", async () => {
  const ab = (await bothWaysFrom(events, recorded()))!;
  assert.equal(bothLine(ab, "Bombas"), "Bombas fans rank Allbirds first; the other seven rank it 9th to 31st or not in their top 50.");
  assert.equal(bothLine(await mjBoth(), "Outdoor Voices"), "Outdoor Voices fans rank Mt. Joy 26th; the other seven rank it 4th to 28th or not in their top 50.");
  assert.equal(bothLine({ ...ab, shown: false }, "Bombas"), null);
  assert.equal(bothLine({ ...ab, rows: ab.rows.map((r, i) => (i === 3 ? { ...r, rev: null } : r)) }, "Bombas"), null);
});

test("J4: inside a tie the first call's reason says whether the both-ways read separates it", async () => {
  const ab = (await bothWaysFrom(events, recorded()))!;
  const all = { size: 8, total: 8 };
  assert.equal(firstCallWhy(ab, "Bombas", all), "All eight are within 0.05 on taste. Bombas is the only one whose fans rank Allbirds first; the other seven rank it 9th to 31st or not in their top 50.");
  assert.equal(firstCallWhy(await mjBoth(), "Outdoor Voices", all), "All eight are within 0.05 on taste, so this is the agent's pick, not a measured lead.");
  assert.equal(firstCallWhy({ ...ab, shown: false }, "Bombas", { size: 6, total: 6 }), "All six are within 0.05 on taste, so this is the agent's pick, not a measured lead.");
  assert.equal(firstCallWhy(null, "Bombas", { size: 5, total: 8 }), "The top five are within 0.05 on taste, so this is the agent's pick, not a measured lead.");
  // a first call ranked 3rd still separates when every other row ranks the seed lower
  const third = { ...ab, rows: ab.rows.map((r) => (r.name === "Bombas" ? { ...r, rev: 3 } : r)) };
  assert.equal(firstCallWhy(third, "Bombas", all), "All eight are within 0.05 on taste. Bombas fans rank Allbirds 3rd, the highest of the eight; the other seven rank it 9th to 31st or not in their top 50.");
  assert.equal(firstCallWhy(ab, "Bombas", null), null);
});

// scripts/slope-check.ts runs the same comparison over every cached ask in Redis
function slopeMatchesTable(b: BothWays) {
  const s = slope(b)!;
  const drawn = b.rows.filter((r) => typeof r.fwd === "number" && r.rev !== null);
  assert.deepEqual(s.rows.map((r) => r.name), drawn.map((r) => r.name));
  s.rows.forEach((r, i) => {
    assert.equal(r.left, cell(drawn[i].fwd));
    if (r.right) assert.equal(r.right, cell(drawn[i].rev));
    else assert.equal(drawn[i].rev, "out"); // only a repeated open end goes unlabelled
    assert.equal(r.climbs, typeof drawn[i].rev === "number" && (drawn[i].rev as number) < (drawn[i].fwd as number));
  });
  return s;
}

test("slopegraph: labels equal the table's cells; Bombas is the one line that climbs; Mt. Joy has none", async () => {
  const ab = slopeMatchesTable((await bothWaysFrom(events, recorded()))!);
  assert.deepEqual(ab.rows.filter((r) => r.climbs).map((r) => r.name), ["Bombas"]);
  assert.deepEqual(ab.rows.filter((r) => r.right).map((r) => r.right), ["1st", "11th", "16th", "31st", "9th", "12th", "30th", "not in their top 50"]);
  const mj = slopeMatchesTable(await mjBoth());
  assert.equal(mj.rows.filter((r) => r.climbs).length, 0);
  assert.equal(mj.rows.filter((r) => r.right === "not in their top 50").length, 1); // five open ends, one label
  for (const s of [ab, mj]) for (const r of s.rows) assert.ok(r.ly1 >= r.y1 && r.ly2 >= r.y2 && r.ly1 < s.height && r.ly2 < s.height);
});

// DES-6 (real Oct 23): the phone drawing has the same rows and labels, and is narrow enough that its 12px text renders
// at 12px or more in a 390 card (340 px wide once it runs into the padding); the open-end label's two lines are the cell
test("slopegraph, phone: same labels as the wide one, and the text renders at 12 px or more at 390", async () => {
  assert.equal(OUT_LINES.join(" "), cell("out"));
  for (const b of [(await bothWaysFrom(events, recorded()))!, await mjBoth()]) {
    const wide = slope(b)!, narrow = slope(b, true)!;
    assert.deepEqual(narrow.rows.map((r) => [r.name, r.left, r.right]), wide.rows.map((r) => [r.name, r.left, r.right]));
    assert.ok((12 * 340) / narrow.w >= 12, `${b.seed}: ${narrow.w} units wide renders ${((12 * 340) / narrow.w).toFixed(1)} px`);
  }
});

// W1 (real Oct 24): the wide drawing's sub-lines come from step 5's one group and the table's cells; no line when the
// review split into groups, and the phone drawing never carries them
test("slopegraph, wide: the sub-lines are the review group's range and the table's best to worst cell", async () => {
  const groups = (ev: AskEvent[]) => (ev.find((e) => (e as { output?: { groups?: unknown } }).output?.groups) as unknown as { output: { groups: { name: string; affinity: number }[][] } }).output.groups;
  const ab = (await bothWaysFrom(events, recorded()))!, mj = await mjBoth();
  assert.equal(leftSub(ab, groups(events)), "all eight score 0.92 to 0.94");
  assert.equal(rightSub(ab), "1st to not in their top 50");
  assert.equal(leftSub(mj, groups(mtJoy as unknown as AskEvent[])), "all eight score 0.94 to 0.97");
  assert.equal(rightSub(mj), "4th to not in their top 50");
  const g = groups(events);
  assert.equal(leftSub(ab, [g[0].slice(0, 3), g[0].slice(3)]), null);
  assert.equal(leftSub(ab, undefined), null);
  assert.deepEqual(slope(ab, true, "x")!.subs, { left: null, right: null });
});
