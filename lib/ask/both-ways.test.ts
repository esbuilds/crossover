// Both ways (Fable's columns ruling, real Oct 15): the demo world's brand and artist asks (lib/ask/demo/) against a recorded getter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bothWaysFrom, gate, sentence, type Row } from "./both-ways.ts";
import allbirds from "./demo/corvid-co.json" with { type: "json" };
import mtJoy from "./demo/low-tide-choir.json" with { type: "json" };
import { bothLine, cell, favoredLine, firstCallHeading, firstCallWhy, leftSub, noTableLine, oneWay, OUT_LINES, rightSub, slope, type BothWays } from "./both-rules.ts";
import type { AskEvent } from "./agent.ts";

// Corvid & Co.'s rank among each candidate's fans' brands, as the getter below returns it (0 = not in their top 50)
const REV: Record<string, number> = { "Larkspur Labs": 1, "Tidewater Swim": 11, Fernway: 16, Brindle: 31, "Sundry Peak": 9, "Lumen Sock Co.": 12, "Wren & Lark": 30, "Velvet Anvil": 0 };
const SEED = "638AC46F-0CE3-4C60-8BEF-3DE40A66B4B1";
const events = allbirds as unknown as AskEvent[];
const cands = (events.find((e) => (e as { output?: { candidates?: unknown } }).output?.candidates) as unknown as { output: { candidates: { name: string; id: string }[] } }).output.candidates;

const recorded = (seen: Record<string, string | number>[] = []) => async (p: Record<string, string | number>) => {
  seen.push(p);
  const name = cands.find((c) => c.id === p["signal.interests.entities"])!.name;
  const at = REV[name];
  return Array.from({ length: 50 }, (_, i) => ({ entity_id: i + 1 === at ? SEED : `x${i}`, name: "x" })) as never;
};

test("Corvid & Co.: eight rows in the frozen review's order, every rank from a recorded request, the three marked", async () => {
  const seen: Record<string, string | number>[] = [];
  const b = (await bothWaysFrom(events, recorded(seen)))!;
  assert.deepEqual(b.rows.map((r) => r.name), ["Larkspur Labs", "Tidewater Swim", "Fernway", "Brindle", "Sundry Peak", "Lumen Sock Co.", "Wren & Lark", "Velvet Anvil"]);
  assert.deepEqual(b.rows.map((r) => r.fwd), [2, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(b.rows.map((r) => r.rev), [1, 11, 16, 31, 9, 12, 30, "out"]);
  assert.deepEqual(b.rows.filter((r) => r.call).map((r) => r.name), ["Larkspur Labs", "Tidewater Swim", "Fernway"]);
  assert.equal(seen.length, 8);
  assert.ok(seen.every((p) => p["filter.type"] === "urn:entity:brand" && p.take === 50));
  assert.equal(b.sentence, "Larkspur Labs fans rank Corvid & Co. first among brands.");
});

const row = (name: string, rev: Row["rev"], call = false): Row => ({ name, fwd: null, rev, call });

test("the sentence prints only at reverse rank 1 to 3, and never names a decision", () => {
  assert.equal(sentence("Low Tide Choir", "artists", row("Brightwell Optics", 26, true)), null);
  assert.equal(sentence("Low Tide Choir", "artists", row("Brightwell Optics", "out", true)), null);
  assert.equal(sentence("Corvid & Co.", "brands", row("Larkspur Labs", 3, true)), "Larkspur Labs fans rank Corvid & Co. third among brands.");
  assert.ok(!/call|should/i.test(sentence("Corvid & Co.", "brands", row("Larkspur Labs", 1, true))!));
});

test("gate: no block when the three don't separate (the Converse case: all outside the top 50)", () => {
  assert.equal(gate([row("Converse", "out", true), row("Vans", "out", true), row("HUF", "out")]), false);
  assert.equal(gate([row("A", 1, true), row("B", 3, true), row("C", 4)]), false); // spread under 5
  assert.equal(gate([row("A", 1, true), row("B", 11, true), row("C", 9)]), true);
});

// The heading follows the measurement (Fable's persona round 2 ruling, Eric approved Oct 15), on the demo asks.
const MJ_REV: Record<string, number> = { "Brightwell Optics": 26, "Corvid & Co.": 4, Bluehour: 0, "Lumen Sock Co.": 0, "Tinderbox Audio": 28, "Velvet Anvil": 0, "Tallgrass Goods": 0, Driftline: 0 };
const MJ = "02898764-3C08-4206-B9CC-17C0B09DD36E";

test("heading: Corvid & Co. keeps 'Call first' (Larkspur Labs fans rank it 1st); Low Tide Choir and no table read 'The agent's first call'", async () => {
  const ab = (await bothWaysFrom(events, recorded()))!;
  assert.equal(firstCallHeading(ab, "Larkspur Labs"), "Call first: Larkspur Labs");
  const mjEvents = mtJoy as unknown as AskEvent[];
  const mjCands = (mjEvents.find((e) => (e as { output?: { candidates?: unknown } }).output?.candidates) as unknown as { output: { candidates: { name: string; id: string }[] } }).output.candidates;
  const mj = (await bothWaysFrom(mjEvents, async (p) => Array.from({ length: 50 }, (_, i) => ({ entity_id: i + 1 === MJ_REV[mjCands.find((c) => c.id === p["signal.interests.entities"])!.name] ? MJ : `x${i}`, name: "x" })) as never))!;
  assert.equal(mj.shown, true);
  assert.equal(firstCallHeading(mj, "Brightwell Optics"), "The agent's first call: Brightwell Optics");
  assert.equal(mj.sentence, null);
  assert.equal(mj.oneWay, null); // 26th is inside the 50: neither sentence
  assert.equal(firstCallHeading(null, "Converse"), "The agent's first call: Converse");
  assert.equal(firstCallHeading({ ...ab, shown: false }, "Larkspur Labs"), "The agent's first call: Larkspur Labs");
});

test("one-way line: the first call's fans don't have the seed in their top 50; names the highest reverse rank", () => {
  const r = (name: string, rev: number | "out", call = false) => ({ name, fwd: null, rev, call });
  const rows = [r("Shinesty", "out", true), r("Chubbies", 18, true), r("Birddogs", 9)];
  assert.equal(oneWay("Tyler Childers", "artists", rows, rows[0]), "Shinesty fans don't have Tyler Childers in their top 50 artists; the pull runs one way. Birddogs fans rank Tyler Childers 9th, the highest of the eight.");
  assert.equal(oneWay("Corvid & Co.", "brands", [r("Larkspur Labs", 1, true)], r("Larkspur Labs", 1, true)), null);
});

// The card line and the slopegraph (COLDJUDGE-8, SPECTACLE-2, real Oct 22): every rank either prints is a table cell.
const mjBoth = async () => {
  const mjEvents = mtJoy as unknown as AskEvent[];
  const mjCands = (mjEvents.find((e) => (e as { output?: { candidates?: unknown } }).output?.candidates) as unknown as { output: { candidates: { name: string; id: string }[] } }).output.candidates;
  return (await bothWaysFrom(mjEvents, async (p) => Array.from({ length: 50 }, (_, i) => ({ entity_id: i + 1 === MJ_REV[mjCands.find((c) => c.id === p["signal.interests.entities"])!.name] ? MJ : `x${i}`, name: "x" })) as never))!;
};

test("card line: the first call's reverse rank, then the other seven's range, from the rows only", async () => {
  const ab = (await bothWaysFrom(events, recorded()))!;
  assert.equal(bothLine(ab, "Larkspur Labs"), "Larkspur Labs fans rank Corvid & Co. first; the other seven rank it 9th to 31st or not in their top 50.");
  assert.equal(bothLine(await mjBoth(), "Brightwell Optics"), "Brightwell Optics fans rank Low Tide Choir 26th; the other seven rank it 4th to 28th or not in their top 50.");
  assert.equal(bothLine({ ...ab, shown: false }, "Larkspur Labs"), null);
  assert.equal(bothLine({ ...ab, rows: ab.rows.map((r, i) => (i === 3 ? { ...r, rev: null } : r)) }, "Larkspur Labs"), null);
});

test("J4: inside a tie the first call's reason says whether the both-ways read separates it", async () => {
  const ab = (await bothWaysFrom(events, recorded()))!;
  const all = { size: 8, total: 8 };
  assert.equal(firstCallWhy(ab, "Larkspur Labs", all), "All eight are within 0.05 on taste. Larkspur Labs is the only one whose fans rank Corvid & Co. first; the other seven rank it 9th to 31st or not in their top 50.");
  assert.equal(firstCallWhy(await mjBoth(), "Brightwell Optics", all), "All eight are within 0.05 on taste, so this is the agent's pick, not a measured lead.");
  assert.equal(firstCallWhy({ ...ab, shown: false }, "Larkspur Labs", { size: 6, total: 6 }), "All six are within 0.05 on taste, so this is the agent's pick, not a measured lead.");
  assert.equal(firstCallWhy(null, "Larkspur Labs", { size: 5, total: 8 }), "The top five are within 0.05 on taste, so this is the agent's pick, not a measured lead.");
  // a first call ranked 3rd still separates when every other row ranks the seed lower
  const third = { ...ab, rows: ab.rows.map((r) => (r.name === "Larkspur Labs" ? { ...r, rev: 3 } : r)) };
  assert.equal(firstCallWhy(third, "Larkspur Labs", all), "All eight are within 0.05 on taste. Larkspur Labs fans rank Corvid & Co. 3rd, the highest of the eight; the other seven rank it 9th to 31st or not in their top 50.");
  assert.equal(firstCallWhy(ab, "Larkspur Labs", null), null);
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

test("slopegraph: labels equal the table's cells; Larkspur Labs is the one line that climbs; Low Tide Choir has none", async () => {
  const ab = slopeMatchesTable((await bothWaysFrom(events, recorded()))!);
  assert.deepEqual(ab.rows.filter((r) => r.climbs).map((r) => r.name), ["Larkspur Labs"]);
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
  assert.equal(leftSub(ab, groups(events)), "all eight score 0.90 to 0.92");
  assert.equal(rightSub(ab), "1st to not in their top 50");
  assert.equal(leftSub(mj, groups(mtJoy as unknown as AskEvent[])), "all eight score 0.94 to 0.97");
  assert.equal(rightSub(mj), "4th to not in their top 50");
  const g = groups(events);
  assert.equal(leftSub(ab, [g[0].slice(0, 3), g[0].slice(3)]), null);
  assert.equal(leftSub(ab, undefined), null);
  assert.deepEqual(slope(ab, true, "x")!.subs, { left: null, right: null });
});

// A-6 (real Oct 27): Low Tide Choir's first call is Brightwell Optics (its fans rank the seed 26th) while another row's
// fans rank it 4th, the best of the eight. The card names that row and says the first call is the agent's pick.
test("A-6: a tie whose first call isn't the one the both-ways read favors names the favored row and its rank", async () => {
  const mj = await mjBoth();
  const all = { size: 8, total: 8 };
  const best = mj.rows.find((r) => r.rev === 4)!.name;
  assert.equal(favoredLine(mj, "Brightwell Optics", all), `The both-ways read favors ${best}, whose fans rank Low Tide Choir 4th, the highest of the eight; Brightwell Optics is the agent's pick.`);
  const ab = (await bothWaysFrom(events, recorded()))!;
  assert.equal(favoredLine(ab, "Larkspur Labs", all), null); // the first call is the favored one
  assert.equal(favoredLine(mj, "Brightwell Optics", null), null); // no tie
  assert.equal(favoredLine({ ...mj, shown: false }, "Brightwell Optics", all), null); // no table, no ranks on the page
  assert.equal(favoredLine({ ...mj, rows: mj.rows.map((r) => (r.rev === 26 ? { ...r, rev: 4 } : r)) }, "Brightwell Optics", all), null); // a shared best names no one
});

// A-4 (real Oct 27): the no-table line said the other direction "doesn't separate these 8" on a page whose picks cite
// reverse ranks 1, 2 and 3. The gate also hides the table when the picks' reverse order is their forward order.
test("A-4: the no-table line says which rule hid the table", () => {
  const row = (name: string, fwd: number, rev: Row["rev"], call: boolean): Row => ({ name, fwd, rev, call });
  const b = (rows: Row[]): BothWays => ({ seed: "Corvid & Co.", noun: "brands", rows, shown: false, sentence: null, oneWay: null });
  const same = b([row("Larkspur Labs", 1, 1, true), row("Fernway", 2, 2, true), row("Brindle", 3, 3, true), row("Velvet Anvil", 4, 12, false)]);
  assert.equal(noTableLine(same), "The other direction was measured too: Larkspur Labs, Fernway and Brindle fans rank Corvid & Co. 1st, 2nd and 3rd, the same order as their taste scores, so it gets no table of its own.");
  const out = b([row("Larkspur Labs", 1, "out", true), row("Fernway", 2, "out", true), row("Brindle", 3, 9, false)]);
  assert.equal(noTableLine(out), "The other direction (each one's fans' rank of Corvid & Co.) was measured and doesn't separate these 3, so there's no table.");
});
