// The replay challenge (the re-judge ruling, real Oct 15): the 23 frozen replay cases (v1's 9, v2's 14 scored) as a
// guess-then-reveal game. Server only: built from the audit files, so nothing is generated and 0 calls are made. The
// eight are shown alphabetically with no mark, as the Converse replay ask was; the reveal shows the published rank.
import replay from "../audit/replay.json" with { type: "json" };
import replayV2 from "../audit/replay-v2.json" with { type: "json" };

export type ChallengeCase = {
  key: string;
  test: "v1" | "v2";
  seed: string; // the entity Qloo scored ("Pepperidge Farm")
  deal: string; // the deal's own name for it ("Goldfish"), as the strip and the audit print it
  partner: string;
  what: string;
  year: number;
  source: string;
  eight: { name: string; score: number }[]; // alphabetical
  rank: number; // the protocol's published rank for the real partner, of 8
  top: number; // the top score among the eight
  hit: boolean; // the protocol's hit: the real partner in its top three
  sameEight: number; // how many of the cases show this exact eight (1 = unique); said after the reveal, never before
};

// the audit files' case shape, loosely: unscored and dropped cases lack some fields
type Raw = { seed: string; partner: string; what: string; year: number; source: string; seedMatched?: string; partnerMatched?: string; partnerId?: string; decoys?: { name: string; id: string }[]; scores?: Record<string, number>; result?: { state?: string; rank?: number; top?: number } };

function toCase(c: Raw, test: "v1" | "v2"): ChallengeCase | null {
  const r = c.result;
  if (r?.state !== "scored" || !r.rank || !c.scores || !c.decoys || !c.partnerId || !c.partnerMatched || !c.seedMatched) return null;
  const scores = c.scores;
  const ids = [{ name: c.partnerMatched, id: c.partnerId }, ...c.decoys.map((d) => ({ name: d.name, id: d.id }))];
  if (ids.length !== 8 || ids.some((x) => typeof scores[x.id] !== "number")) return null; // the gate: every case complete
  return {
    key: `${test}:${c.seed}:${c.partner}`,
    test,
    seed: c.seedMatched,
    deal: c.seed,
    partner: c.partnerMatched,
    what: c.what,
    year: c.year,
    source: c.source,
    eight: ids.map((x) => ({ name: x.name, score: scores[x.id] })).sort((a, b) => a.name.localeCompare(b.name)),
    rank: r.rank,
    top: r.top ?? Math.max(...ids.map((x) => scores[x.id])),
    hit: r.rank <= 3,
    sameEight: 1,
  };
}

export const CHALLENGE: ChallengeCase[] = [
  ...(replay.cases as unknown as Raw[]).map((c) => toCase(c, "v1")),
  ...(replayV2.cases as unknown as Raw[]).map((c) => toCase(c, "v2")),
].filter((c): c is ChallengeCase => c !== null);

// A review ruling (Oct 15): deals in the same aisle share decoys; count each set of eight across the cases
const setOf = (c: ChallengeCase) => c.eight.map((x) => x.name).join("|");
for (const c of CHALLENGE) c.sameEight = CHALLENGE.filter((x) => setOf(x) === setOf(c)).length;

export const PROTOCOL = { v1: replay.summary!, v2: replayV2.summary! };
