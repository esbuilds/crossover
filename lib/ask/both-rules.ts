// The both-ways rules, client-safe (no server imports): the gate, the two sentences and the heading. lib/ask/both-ways.ts
// measures; the ask page and the sheet render from these (Fable's columns and persona round 2 rulings, Oct 15).
export const OUT = 51; // "not in their top 50", for the gate's arithmetic only
export type Rank = number | "out" | null; // null: no measurement (never fetched), never shown as a blank
export type Row = { name: string; fwd: Rank; rev: Rank; call: boolean };
// shown: the gate passed and the table draws; when it fails the page says the other direction didn't separate the eight
export type BothWays = { seed: string; noun: string; rows: Row[]; shown: boolean; sentence: string | null; oneWay: string | null };

const ORD = ["first", "second", "third"];
export const NOUN: Record<string, string> = { "urn:entity:brand": "brands", "urn:entity:artist": "artists" };

export function gate(rows: Row[]): boolean {
  const calls = rows.filter((r) => r.call);
  const at = (r: Rank) => (typeof r === "number" ? r : OUT);
  const revs = calls.map((r) => at(r.rev));
  if (calls.length < 2 || Math.max(...revs) - Math.min(...revs) < 5) return false;
  const byRev = [...rows].sort((x, y) => at(x.rev) - at(y.rev));
  return calls.some((r, i) => byRev[i] !== r);
}

// The mirror (Fable's persona round 2 ruling, Oct 15): the first call's fans don't have the seed in their top 50. Names the
// candidate whose fans rank the seed highest; nothing is reordered. Tyler Childers: Shinesty out, Chubbies 18th.
export function oneWay(seed: string, noun: string, rows: Row[], first: Row | undefined): string | null {
  if (!first || first.rev !== "out") return null;
  const best = rows.filter((r) => r !== first && typeof r.rev === "number").sort((a, b) => (a.rev as number) - (b.rev as number))[0];
  const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
  return `${first.name} fans don't have ${seed} in their top 50 ${noun}; the pull runs one way.${best ? ` ${best.name} fans rank ${seed} ${ord(best.rev as number)}, the highest of the eight.` : ""}`;
}

// The heading follows the measurement (Fable's persona round 2 ruling, Eric approved Oct 15): "Call first" only when the
// first call's fans also rank the seed 1st to 3rd; otherwise it's the agent's call, stated as such. Rendering only.
export function firstCallHeading(b: BothWays | null, first: string): string {
  const row = b?.shown ? b.rows.find((r) => r.name === first) : undefined;
  return typeof row?.rev === "number" && row.rev <= 3 ? `Call first: ${first}` : `The agent's first call: ${first}`;
}

export function sentence(seed: string, noun: string, first: Row | undefined): string | null {
  return first && typeof first.rev === "number" && first.rev <= 3 ? `${first.name} fans rank ${seed} ${ORD[first.rev - 1]} among ${noun}.` : null;
}

