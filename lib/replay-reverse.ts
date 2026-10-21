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
