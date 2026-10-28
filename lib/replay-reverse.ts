// The reverse replay (PROOF-2, audit/replay-reverse-protocol.md): rank the eight by where each one's own fans put the seed.
// at[i]: the seed's position (1 to 50) in candidate i's fans' top 50 brands, or null when it isn't there.
// Lower position ranks higher; every null ties below every number. Ties break against the real partner (it takes the
// last place in its tie), so the rule can never flatter the partner the way the stored popularityRank did.
export function partnerRank(at: (number | null)[], partner: number): number {
  const key = (v: number | null) => v ?? Infinity;
  const p = key(at[partner]);
  return 1 + at.filter((v, i) => i !== partner && key(v) <= p).length;
}

export const isHit = (at: (number | null)[], partner: number) => partnerRank(at, partner) <= 3;

export const REVERSE_FREEZE = "87eeb84";
type Reverse = { summary: { cases: number; need: number; realHits: number; scrambledHits: number; pass: boolean; seedOutCells: number; cells: number; v2: { cases: number; realHits: number; scrambledHits: number } }; cases: { cells: { seed: number | null }[] }[] };
// the /audit paragraph under Replay controls; every number is read from audit/replay-reverse.json
export function reverseSentences(r: Reverse) {
  const s = r.summary;
  const seen = r.cases.reduce((n, c) => n + c.cells.filter((x) => x.seed !== null).length, 0);
  const partner = r.cases.filter((c) => c.cells[0].seed !== null).length;
  return [
    `Reverse replay: each case's eight ranked the other way, by where each one's own fans put the seed, with ties and "not in their top 50" counted against the real partner. ${s.pass ? "It passes" : "It fails its bar"}: the real partner came in the top three ${s.realHits} times in ${s.cases} (needed ${s.need}), against ${s.scrambledHits} under the scrambled seeds; for the second test alone, ${s.v2.realHits} of ${s.v2.cases} against ${s.v2.scrambledHits}.`,
    `Of the ${seen} lists that held the seed, ${partner} were the real partner's, a count made after the run, not a test.`,
  ];
}

// the line under the paragraph: why it failed, from the same run
export const reverseLimit = (r: Reverse) =>
  `With take=50, the reverse direction can't be measured for most pairs: the seed was missing from ${r.summary.seedOutCells} of the ${r.summary.cells} fans' top 50 lists in this run.`;
