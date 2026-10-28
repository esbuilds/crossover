// Smaller names: the rules and the line, client-safe (lib/ask/smaller.ts holds the
// Qloo reads), as both-rules.ts is for both-ways.
export const CAP = 0.5;
export const GAP = 0.05;
export type Row = { name: string; affinity: number; popularity: number };
export type Smaller = { seed: string; cap: number; leader: Row; rows: Row[] };

// The leader's note when it's the same-field rival the agent set aside, so "then why not call it?"
// answers itself. rival: the findRival step's pick and step number.
export const asideNote = (s: Smaller, rival?: { name: string; step: number } | null) => (rival && rival.name === s.leader.name ? `the rival the agent set aside in step ${rival.step}` : null);

// The line under the block. Numbers only from the rows; no percentages (copy rule).
export function smallerLine(s: Smaller, rival?: { name: string; step: number } | null): string {
  const aside = asideNote(s, rival);
  const lead = `${s.leader.name}${aside ? `, ${aside},` : ""} leads ${s.seed} fans' brands at ${s.leader.affinity.toFixed(2)} with popularity ${s.leader.popularity.toFixed(2)}.`;
  if (!s.rows.length) return `${lead} No brand under popularity ${s.cap.toFixed(1)} comes within ${GAP} of it, so here fame and fit go together.`;
  const best = s.rows[0];
  return `${lead} ${best.name}, at popularity ${best.popularity.toFixed(2)}, scores ${best.affinity.toFixed(2)}: ${s.rows.length === 1 ? "the one brand" : `one of ${s.rows.length} brands`} under popularity ${s.cap.toFixed(1)} within ${GAP} of the leader, the same tie rule the answer uses.`;
}
