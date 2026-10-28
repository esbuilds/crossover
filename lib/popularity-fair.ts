// Popularity alone, ties broken fairly. The replay files store a popularityRank that
// sorts the real partner first among equal popularities (scripts/replay-score.ts lists it first, and the sort is
// stable), so it reads 21 of 23 in the top three. Fair: under a random tie-break the partner lands in the top three
// with probability (3 - higher) / (tied + 1), capped at 1. Re-analysis of stored numbers, 0 calls, not a test.
import replay from "../audit/replay.json" with { type: "json" };
import replayV2 from "../audit/replay-v2.json" with { type: "json" };

type Raw = { seed: string; partner: string; partnerPopularity?: number; decoys?: { popularity: number }[]; result?: { state?: string; rank?: number; popularityRank?: number } };

export function topThreeChance(partner: number, decoys: number[]) {
  const higher = decoys.filter((p) => p > partner).length;
  const tied = decoys.filter((p) => p === partner).length;
  return higher >= 3 ? 0 : Math.min(1, (3 - higher) / (tied + 1));
}

export function popularityFair() {
  const scored = ([...replay.cases, ...replayV2.cases] as unknown as Raw[]).filter((c) => c.result?.state === "scored");
  const chances = scored.map((c) => topThreeChance(c.partnerPopularity!, c.decoys!.map((d) => d.popularity)));
  const cases = scored.map((c, i) => ({
    pair: `${c.seed} x ${c.partner}`,
    chance: Math.round(chances[i] * 1000) / 1000,
    storedPopularityRank: c.result!.popularityRank!,
    affinityRank: c.result!.rank!,
  }));
  const expected = chances.reduce((a, b) => a + b, 0);
  return {
    scored: cases.length,
    expectedTopThree: Math.round(expected * 10) / 10,
    storedTopThree: cases.filter((c) => c.storedPopularityRank <= 3).length,
    affinityTopThree: cases.filter((c) => c.affinityRank <= 3).length,
    cases,
  };
}

// the one sentence under the v2 block on /audit; every number is computed above
export function fairSentence(f: { scored: number; expectedTopThree: number; affinityTopThree: number; storedTopThree: number }) {
  return `Popularity alone, with ties broken fairly, puts the real partner in the top three about ${f.expectedTopThree} of ${f.scored} times, against ${f.affinityTopThree} of ${f.scored} for the seed's fans (both tests pooled, after the fact). The popularityRank field in the replay files breaks ties in the partner's favor and reads ${f.storedTopThree}; it is not a result.`;
}
