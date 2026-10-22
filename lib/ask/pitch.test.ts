// The pitch sheet (W2, real Oct 24): the seller's pick and line from the cached Mt. Joy and Allbirds asks and their
// both-ways rows (as cached on production, real Oct 23), checked by the frozen checker with one appended step.
import { test } from "node:test";
import assert from "node:assert/strict";
import allbirds from "./fixtures/allbirds.json" with { type: "json" };
import mtJoy from "./fixtures/mt-joy.json" with { type: "json" };
import { pitchModel } from "./pitch.ts";
import { pitchPick } from "./pitch-rules.ts";
import { checkEdit } from "./fool.ts";
import { forDisplay } from "./check.ts";
import type { BothWays, Rank } from "./both-rules.ts";
import type { AskEvent } from "./agent.ts";

const both = (seed: string, noun: string, rows: [string, number, Rank, boolean][]): BothWays => ({ seed, noun, shown: true, sentence: null, oneWay: null, rows: rows.map(([name, fwd, rev, call]) => ({ name, fwd, rev, call })) });
const MJ = both("Mt. Joy", "artists", [["Outdoor Voices", 1, 26, true], ["Allbirds", 2, 4, true], ["Alternative Apparel", 3, "out", true], ["Felix Gray", 4, "out", false], ["LaCroix Sparkling Water", 5, 28, false], ["Summersalt", 6, "out", false], ["Marine Layer", 7, "out", false], ["Carve Designs", 8, "out", false]]);
const AB = both("Allbirds", "brands", [["Bombas", 2, 1, true], ["Warby Parker", 4, 11, true], ["ClassPass", 5, 16, true], ["Parachute", 6, 31, false], ["Tuft & Needle", 7, 9, false], ["Felix Gray", 8, 12, false], ["Quince", 9, 30, false], ["Summersalt", 10, "out", false]]);
const mj = () => pitchModel(mtJoy as unknown as AskEvent[], MJ)!;

test("pitch: Mt. Joy pitches Allbirds first, in the spec's words, and the checker passes it", () => {
  const p = mj();
  assert.equal(p.check.ok, true);
  assert.equal(p.question, "Who should Mt. Joy pitch first?");
  assert.equal(p.card, "Allbirds fans rank Mt. Joy 4th among artists. Mt. Joy fans rank Allbirds 2nd among brands.");
  assert.equal(p.line, "Your fans already rank Mt. Joy 4th among artists, and Mt. Joy fans rank Allbirds 2nd among brands at 0.95.");
  assert.equal(p.decision.calls[0].reason, "[[Allbirds]] fans rank [[Mt. Joy]] 4 among artists, and [[Allbirds]] scores 0.95 and ranks 2 among [[Mt. Joy]] fans.");
  assert.equal(p.caution, "Outdoor Voices fans rank Mt. Joy 26th among artists, and Alternative Apparel fans don't have Mt. Joy in their top 50.");
  assert.equal(p.decision.cautions[0].text, "[[Outdoor Voices]] fans rank [[Mt. Joy]] 26 among artists, and [[Alternative Apparel]] fans don't have [[Mt. Joy]] in their top 50.");
  assert.equal(p.summary, "Of the 8 names, Allbirds fans rank Mt. Joy highest, at 4th.");
  assert.deepEqual(p.footnotes.at(-1), { n: 6, label: "Both ways", summary: "each name's fans' own top 50 of artists, one Qloo call per name, computed by code beside the answer." });
  assert.match(p.limits[1], /5 times in 23, against 3/);
  for (const t of [p.line, p.card, p.caution!, p.summary, ...p.limits]) assert.doesNotMatch(t, /%|—|predicts|\bwins\b/);
});

test("pitch: Allbirds pitches Bombas, the agent's own first call, so there's no caution", () => {
  const p = pitchModel(allbirds as unknown as AskEvent[], AB)!;
  assert.equal(p.check.ok, true);
  assert.equal(p.pick, "Bombas");
  assert.equal(p.decision.cautions.length, 0);
  assert.equal(p.caution, null);
  assert.equal(p.limits[0], "That Bombas has a partnership budget; Qloo measures taste, not deals.");
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
  for (const [from, to] of [["Mt. Joy 4 among", "Mt. Joy 1 among"], ["0.95", "0.98"], ["Allbirds fans", "Nike fans"], ["Mt. Joy 4 among", "Mt. Joy 26 among"]]) {
    assert.equal(edit(from, to).ok, false, `${from} -> ${to}`);
  }
});
