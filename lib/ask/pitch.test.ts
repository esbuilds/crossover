// The pitch sheet: the seller's pick and line from the demo world's artist and brand asks (lib/ask/demo/,
// shaped like the cached Mt. Joy and Allbirds asks) and their both-ways rows, checked by the frozen checker with one appended step.
import { test } from "node:test";
import assert from "node:assert/strict";
import allbirds from "./demo/corvid-co.json" with { type: "json" };
import mtJoy from "./demo/low-tide-choir.json" with { type: "json" };
import { pitchModel } from "./pitch.ts";
import { pitchPick } from "./pitch-rules.ts";
import { checkEdit } from "./fool.ts";
import { forDisplay } from "./check.ts";
import type { BothWays, Rank } from "./both-rules.ts";
import type { AskEvent } from "./agent.ts";

const both = (seed: string, noun: string, rows: [string, number, Rank, boolean][]): BothWays => ({ seed, noun, shown: true, sentence: null, oneWay: null, rows: rows.map(([name, fwd, rev, call]) => ({ name, fwd, rev, call })) });
const MJ = both("Low Tide Choir", "artists", [["Brightwell Optics", 1, 26, true], ["Corvid & Co.", 2, 4, true], ["Bluehour Apparel", 3, "out", true], ["Lumen Sock Co.", 4, "out", false], ["Tinderbox Audio", 5, 28, false], ["Velvet Anvil", 6, "out", false], ["Tallgrass Goods", 7, "out", false], ["Driftline", 8, "out", false]]);
const AB = both("Corvid & Co.", "brands", [["Larkspur Labs", 2, 1, true], ["Tidewater Swim", 4, 11, true], ["Fernway", 5, 16, true], ["Brindle", 6, 31, false], ["Sundry Peak", 7, 9, false], ["Lumen Sock Co.", 8, 12, false], ["Wren & Lark", 9, 30, false], ["Velvet Anvil", 10, "out", false]]);
const mj = () => pitchModel(mtJoy as unknown as AskEvent[], MJ)!;

test("pitch: Low Tide Choir pitches Corvid & Co. first, in the spec's words, and the checker passes it", () => {
  const p = mj();
  assert.equal(p.check.ok, true);
  assert.equal(p.question, "Who should Low Tide Choir pitch first?");
  assert.equal(p.card, "Corvid & Co. fans rank Low Tide Choir 4th among artists. Low Tide Choir fans rank Corvid & Co. 2nd among brands.");
  assert.equal(p.line, "Your fans already rank Low Tide Choir 4th among artists, and Low Tide Choir fans rank Corvid & Co. 2nd among brands at 0.96.");
  assert.equal(p.decision.calls[0].reason, "[[Corvid & Co.]] fans rank [[Low Tide Choir]] 4 among artists, and [[Corvid & Co.]] scores 0.96 and ranks 2 among [[Low Tide Choir]] fans.");
  assert.equal(p.caution, "Brightwell Optics fans rank Low Tide Choir 26th among artists, and Bluehour Apparel fans don't have Low Tide Choir in their top 50.");
  assert.equal(p.decision.cautions[0].text, "[[Brightwell Optics]] fans rank [[Low Tide Choir]] 26 among artists, and [[Bluehour Apparel]] fans don't have [[Low Tide Choir]] in their top 50.");
  assert.equal(p.summary, "Of the 8 names, Corvid & Co. fans rank Low Tide Choir highest, at 4th.");
  assert.deepEqual(p.footnotes.at(-1), { n: 6, label: "Both ways", summary: "each name's fans' own top 50 of artists, one Qloo call per name, computed by code beside the answer." });
  assert.match(p.limits[1], /5 times in 23, against 3/);
  for (const t of [p.line, p.card, p.caution!, p.summary, ...p.limits]) assert.doesNotMatch(t, /%|—|predicts|\bwins\b/);
});

test("pitch: Corvid & Co. pitches Larkspur Labs, the agent's own first call, so there's no caution", () => {
  const p = pitchModel(allbirds as unknown as AskEvent[], AB)!;
  assert.equal(p.check.ok, true);
  assert.equal(p.pick, "Larkspur Labs");
  assert.equal(p.decision.cautions.length, 0);
  assert.equal(p.caution, null);
  assert.equal(p.limits[0], "That Larkspur Labs has a partnership budget; Qloo measures taste, not deals.");
});

test("pitch: no row with a number, no pick; a hidden table, no sheet", () => {
  assert.equal(pitchPick(MJ.rows.map((r) => ({ ...r, rev: "out" }))), null);
  assert.equal(pitchModel(mtJoy as unknown as AskEvent[], { ...MJ, shown: false }), null);
});

test("pitch: the fool-it box rejects each tamper of the line", () => {
  const p = mj();
  const shown = forDisplay(p.decision.calls[0].reason);
  const edit = (from: string, to: string) => checkEdit(p.decision, p.steps, shown, shown.replace(from, to));
  assert.equal(edit("x", "x").ok, true);
  for (const [from, to] of [["Low Tide Choir 4 among", "Low Tide Choir 1 among"], ["0.96", "0.99"], ["Corvid & Co. fans", "Nike fans"], ["Low Tide Choir 4 among", "Low Tide Choir 26 among"]]) {
    assert.equal(edit(from, to).ok, false, `${from} -> ${to}`);
  }
});
