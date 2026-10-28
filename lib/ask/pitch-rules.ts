// The seller's side: the same both-ways rows read down the right column. Pure and client-safe. The
// pick and every line are code over the table's cells and the review step's score, never the model; lib/ask/pitch.ts
// runs the checked forms through the frozen checker.
import { COUNT, th, type BothWays, type Row } from "./both-rules.ts";
import type { Decision } from "./check.ts";
import { poss } from "../vs.ts";

// the row whose fans rank the seed highest, ties to the better forward rank; null when no row has both ranks
export function pitchPick(rows: Row[]): Row | null {
  const n = rows.filter((r) => typeof r.rev === "number" && typeof r.fwd === "number");
  return n.sort((a, b) => (a.rev as number) - (b.rev as number) || (a.fwd as number) - (b.fwd as number))[0] ?? null;
}

export type PitchLines = { decision: Decision; card: string; line: string; caution: string | null; summary: string; limits: string[] };

// One sentence builder for both forms: the checked one (bracketed names, plain numbers) and the shown one (ordinals).
// first: the agent's first call. review, both: the review step and the appended both-ways step. reverse: the replay
// counts from audit/replay-reverse.json.
export function pitchLines(b: BothWays, pick: Row, o: { first: string; score: number; artist: boolean; review: number; both: number; reverse: { cases: number; realHits: number; scrambledHits: number } }): PitchLines {
  const S = b.seed, P = pick.name, rev = pick.rev as number, fwd = pick.fwd as number, score = o.score.toFixed(2);
  const fans = (bk: boolean, r: Row) => {
    const [x, s] = bk ? [`[[${r.name}]]`, `[[${S}]]`] : [r.name, S];
    return typeof r.rev === "number" ? `${x} fans rank ${s} ${bk ? r.rev : th(r.rev)} among ${b.noun}` : `${x} fans don't have ${s} in their top 50`;
  };
  // the agent's other calls, when the pitch isn't its first call: why the buyer's list leads elsewhere
  const others = o.first !== P ? b.rows.filter((r) => r.call && r !== pick && r.rev !== null) : [];
  const join = (xs: string[]) => (xs.length < 3 ? xs.join(", and ") : `${xs.slice(0, -1).join(", ")}, and ${xs.at(-1)}`);
  const caution = (bk: boolean) => (others.length ? `${join(others.map((r) => fans(bk, r)))}.` : null);
  const n = b.rows.length;
  return {
    decision: {
      calls: [{ name: P, reason: `${fans(true, pick)}, and [[${P}]] scores ${score} and ranks ${fwd} among [[${S}]] fans.`, steps: [o.review, o.both] }],
      cautions: others.length ? [{ text: caution(true)!, steps: [o.both] }] : [],
      summary: [{ text: `Of the ${n} names, [[${P}]] fans rank [[${S}]] highest, at ${rev}.`, steps: [o.both] }],
    },
    card: `${fans(false, pick)}. ${S} fans rank ${P} ${th(fwd)} among brands.`,
    line: `Your fans already rank ${S} ${th(rev)} among ${b.noun}, and ${S} fans rank ${P} ${th(fwd)} among brands at ${score}.`,
    caution: caution(false),
    summary: `Of the ${n} names, ${P} fans rank ${S} highest, at ${th(rev)}.`,
    limits: [
      o.artist ? `That ${P} sponsors tours or has a budget; Qloo measures taste, not deals.` : `That ${P} has a partnership budget; Qloo measures taste, not deals.`,
      `That a high rank closes the deal. Ranked this way, the replay found the real partner ${o.reverse.realHits} times in ${o.reverse.cases}, against ${o.reverse.scrambledHits} for a scrambled seed; the counts are on /audit.`,
      `That these ${COUNT[n] ?? n} are sponsors. They are brands ${poss(S)} fans favor, read the other way.`,
    ],
  };
}

export const PITCH_CAPTION = "Read down the right column. The left column is the buyer's shortlist; the right is the seller's pitch line.";
export const PITCH_WHO = "Who this is for: the sponsorship seller who has to send the first email, and the partnerships lead who reads it.";
