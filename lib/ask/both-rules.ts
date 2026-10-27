// The both-ways rules, client-safe (no server imports): the gate, the two sentences and the heading. lib/ask/both-ways.ts
// measures; the ask page and the sheet render from these (the columns and persona round 2 rulings, Oct 15).
import { poss } from "../vs.ts";
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

// The mirror (the persona round 2 ruling, Oct 15): the first call's fans don't have the seed in their top 50. Names the
// candidate whose fans rank the seed highest; nothing is reordered. Tyler Childers: Shinesty out, Chubbies 18th.
export function oneWay(seed: string, noun: string, rows: Row[], first: Row | undefined): string | null {
  if (!first || first.rev !== "out") return null;
  const best = rows.filter((r) => r !== first && typeof r.rev === "number").sort((a, b) => (a.rev as number) - (b.rev as number))[0];
  const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
  return `${first.name} fans don't have ${seed} in their top 50 ${noun}; the pull runs one way.${best ? ` ${best.name} fans rank ${seed} ${ord(best.rev as number)}, the highest of the eight.` : ""}`;
}

// Names the both-ways read (DEEP-1, real Oct 23), above the slopegraph on every answer page that draws one. Crossover
// asks from both sides, not the agent: the reverse ranks are code's (lib/ask/both-ways.ts).
export const readBoth = (seed: string) => `Read both ways: the left is where ${poss(seed)} fans rank each name, the right is where that name's fans rank ${seed}. Each Qloo call ranks from one side; Crossover asks from both.`;

// Who it's for, both sides of one call (DEEP-3, DEEP-7, real Oct 23), under the answer and at the foot of the call
// sheet; the legend only where the both-ways table renders.
export const WHO = "Who this is for: the partnerships lead who has to pick up the phone, and the sponsorship seller on the other end of it.";
export const LEGEND = "The left column is the shortlist; the right column is the pitch line.";

// The heading follows the measurement (the persona round 2 ruling, Eric approved Oct 15): "Call first" only when the
// first call's fans also rank the seed 1st to 3rd; otherwise it's the agent's call, stated as such. Rendering only.
export function firstCallHeading(b: BothWays | null, first: string): string {
  const row = b?.shown ? b.rows.find((r) => r.name === first) : undefined;
  return typeof row?.rev === "number" && row.rev <= 3 ? `Call first: ${first}` : `The agent's first call: ${first}`;
}

export function sentence(seed: string, noun: string, first: Row | undefined): string | null {
  return first && typeof first.rev === "number" && first.rev <= 3 ? `${first.name} fans rank ${seed} ${ORD[first.rev - 1]} among ${noun}.` : null;
}

// A rank as the table prints it. The card line and the slopegraph print ranks only through this, so every rank they
// show is one of the table's cells.
export const th = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
export const cell = (r: Rank) => (r === null ? "no measurement" : r === "out" ? "not in their top 50" : th(r));

export const COUNT = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight"];
// The card's both-ways line (COLDJUDGE-8, HARSH-3, real Oct 22): the first call's fans' rank of the seed, then the other
// rows' range, from the table's rows only. Allbirds: "Bombas fans rank Allbirds first; the other seven rank it 9th to
// 31st or not in their top 50." null when the table isn't shown or any rank wasn't measured.
export function bothLine(b: BothWays | null, first: string): string | null {
  const row = b?.shown ? b.rows.find((r) => r.name === first) : undefined;
  if (!b || !row || b.rows.some((r) => r.rev === null)) return null;
  const others = b.rows.filter((r) => r !== row);
  const ranks = others.flatMap((r) => (typeof r.rev === "number" ? [r.rev] : [])).sort((x, y) => x - y);
  const n = COUNT[others.length] ?? String(others.length);
  const head = typeof row.rev === "number" ? `${row.name} fans rank ${b.seed} ${row.rev <= 3 ? ORD[row.rev - 1] : th(row.rev)}` : `${row.name} fans don't have ${b.seed} in their top 50`;
  if (!ranks.length) return `${head}; none of the other ${n} have it in their top 50.`;
  const span = ranks[0] === ranks.at(-1) ? th(ranks[0]) : `${th(ranks[0])} to ${th(ranks.at(-1)!)}`;
  return `${head}; the other ${n} rank it ${span}${ranks.length < others.length ? " or not in their top 50" : ""}.`;
}

// The both-ways slopegraph (SPECTACLE-2, real Oct 22): the table's two rank columns as one picture, on one log scale
// (1st at the top, 50th at the bottom, "not in their top 50" under it as an open end). Labels are spaced apart and a
// short leader runs to the true point. Rows missing a rank aren't drawn; the table still lists them. The width fits the
// longest label (CH: a 13px system-font character, estimated), so a phone draws the text as large as it can.
export const SLOPE = { top: 46, h: 200, gap: 17, span: 70, pad: 18 };
const CH = 7.4;
// Asked both ways (W1, real Oct 24): the wide drawing gets twice the span and room above the axes for the two direction
// arrows and an italic sub-line under each header (11.5px, so CH scaled). The phone drawing and the sheet are unchanged.
// sub: the italic line measured 5.3 per character (real Oct 24, Chromium), 0.75 of CH leaves a margin
const WIDE = { top: 60, span: 140, sub: 0.75 };
// Phones (DES-6, real Oct 23): the same rows and labels in a tighter frame, so the text renders at 12 px or more in a
// 390 card instead of scaling down to 9 to 11. 12px characters, a shorter span, and the shared open-end label set on
// two lines (OUT_LINES), the widest right-hand label on every Mt. Joy-style card.
const NARROW = { ch: 6.83, span: 40, pad: 10 };
export const OUT_LINES = ["not in their", "top 50"];
export type SlopeRow = { name: string; left: string; right: string; y1: number; y2: number; ly1: number; ly2: number; out: boolean; climbs: boolean; call: boolean };
const y = (r: number, top: number) => top + (Math.log(r) / Math.log(50)) * SLOPE.h;

// The first call's reason inside a tie (J4, judge round real Oct 25: all four judges read "First call" over "No clear
// three" as a contradiction). tie: the review's tied group (lib/ask/steps.ts tieOf), else null. When the both-ways read
// separates the first call (its fans rank the seed above every other row's fans), say how, from the table's cells; when
// it doesn't, say plainly that the call is the agent's. null outside a tie: the card keeps bothLine.
export function firstCallWhy(b: BothWays | null, first: string, tie: { size: number; total: number } | null): string | null {
  if (!tie) return null;
  const n = COUNT[tie.size] ?? String(tie.size);
  const head = `${tie.size === tie.total ? `All ${n}` : `The top ${n}`} are within 0.05 on taste`;
  const row = b?.shown ? b.rows.find((r) => r.name === first) : undefined;
  const others = b && row ? b.rows.filter((r) => r !== row) : [];
  const at = (r: Rank) => (typeof r === "number" ? r : OUT);
  const line = b && row ? bothLine(b, first) : null;
  const separates = !!line && typeof row!.rev === "number" && others.every((r) => at(r.rev) > (row!.rev as number));
  if (!separates) return `${head}, so this is the agent's pick, not a measured lead.`;
  const lead = row!.rev === 1 ? `${first} is the only one whose fans rank ${b!.seed} first` : `${first} fans rank ${b!.seed} ${th(row!.rev as number)}, the highest of the ${COUNT[b!.rows.length] ?? b!.rows.length}`;
  return `${head}. ${lead}; ${line!.slice(line!.indexOf("; ") + 2)}`;
}

// A tie whose first call isn't the one the both-ways read favors (A-6, real Oct 27: Mt. Joy's first call is Outdoor
// Voices, 26th, while Allbirds fans rank it 4th): name the row whose fans alone rank the seed highest and say the first
// call is the agent's pick, so the rule reads the same as on a page where the read decides. Table cells only; null when
// there's no tie, no table, an unmeasured rank, a shared best, or the first call is the favored row.
export function favoredLine(b: BothWays | null, first: string, tie: { size: number; total: number } | null): string | null {
  if (!tie || !b?.shown || b.rows.some((r) => r.rev === null)) return null;
  const at = (r: Rank) => (typeof r === "number" ? r : OUT);
  const best = Math.min(...b.rows.map((r) => at(r.rev)));
  const top = b.rows.filter((r) => at(r.rev) === best);
  if (top.length !== 1 || top[0].name === first || typeof top[0].rev !== "number") return null;
  return `The both-ways read favors ${top[0].name}, whose fans rank ${b.seed} ${th(top[0].rev)}, the highest of the ${COUNT[b.rows.length] ?? b.rows.length}; ${first} is the agent's pick.`;
}

// Why there's no both-ways table (A-4, real Oct 27). The gate also hides it when the picks' reverse ranks run in their
// forward order (Arby's: Wendy's, Denny's and DiGiorno fans rank it 1st, 2nd and 3rd), where "doesn't separate" was
// wrong and the picks then cited those ranks. Say that rule with its cells; otherwise the line as before.
export function noTableLine(b: BothWays): string {
  const calls = b.rows.filter((r) => r.call);
  const revs = calls.map((r) => r.rev);
  const inOrder = calls.length > 1 && revs.every((r, i) => typeof r === "number" && (i === 0 || r > (revs[i - 1] as number)));
  const list = (xs: string[]) => `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
  if (inOrder) return `The other direction was measured too: ${list(calls.map((r) => r.name))} fans rank ${b.seed} ${list(revs.map((r) => th(r as number)))}, the same order as their taste scores, so it gets no table of its own.`;
  return `The other direction (each one's fans' rank of ${b.seed}) was measured and doesn't separate these ${b.rows.length}, so there's no table.`;
}
const outY = (top: number) => top + SLOPE.h + 20;
// each used label at its point, or one gap below the label above it
function spread(ys: number[], use: boolean[]) {
  const out = [...ys];
  let prev = -Infinity;
  for (const i of ys.map((_, i) => i).filter((i) => use[i]).sort((a, b) => ys[a] - ys[b])) prev = out[i] = Math.max(ys[i], prev + SLOPE.gap);
  return out;
}
// left: leftSub's line, wide only. The phone drawing ignores both sub-lines. lead: the pitch sheet's pick (W2), the one
// line in the accent instead of the climbing one
export function slope(b: BothWays, narrow = false, left: string | null = null, lead?: string): { rows: SlopeRow[]; height: number; l: number; r: number; w: number; top: number; subs: { left: string | null; right: string | null } } | null {
  const drawn = b.rows.filter((r) => typeof r.fwd === "number" && r.rev !== null);
  if (!b.shown || drawn.length < 2) return null;
  const top = narrow ? SLOPE.top : WIDE.top, OUT_Y = outY(top);
  const subs = narrow ? { left: null, right: null } : { left, right: rightSub(b) };
  const y1 = drawn.map((r) => y(r.fwd as number, top));
  const y2 = drawn.map((r) => (r.rev === "out" ? OUT_Y : y(r.rev as number, top)));
  // the open ends share one point, so only the first of them carries the label
  const firstOut = drawn.findIndex((r) => r.rev === "out");
  const right = drawn.map((r, i) => (r.rev === "out" && i !== firstOut ? "" : cell(r.rev)));
  const ly1 = spread(y1, drawn.map(() => true));
  const ly2 = spread(y2, right.map(Boolean));
  const rows = drawn.map((r, i) => ({ name: r.name, left: cell(r.fwd), right: right[i], y1: y1[i], y2: y2[i], ly1: ly1[i], ly2: ly2[i], out: r.rev === "out", climbs: lead ? r.name === lead : typeof r.rev === "number" && r.rev < (r.fwd as number), call: r.call }));
  const { ch, span, pad } = narrow ? NARROW : { ch: CH, span: WIDE.span, pad: SLOPE.pad };
  const subLen = (t: string | null) => (t ? t.length * WIDE.sub : 0);
  const outLabel = cell("out");
  const rightLen = (t: string) => (narrow && t === outLabel ? Math.max(...OUT_LINES.map((x) => x.length)) : t.length);
  const l = Math.ceil(Math.max(`${b.seed} fans`.length, subLen(subs.left), ...rows.map((x) => `${x.name} ${x.left}`.length)) * ch) + pad;
  const r = l + span;
  const w = r + pad + Math.ceil(Math.max("Its fans rank".length, b.seed.length, subLen(subs.right), ...rows.map((x) => rightLen(x.right))) * ch);
  const outDrop = narrow && rows.some((x) => x.right === outLabel) ? 15 : 0; // the open-end label's second line
  return { rows, height: Math.ceil(Math.max(OUT_Y + outDrop, ...ly1, ...ly2)) + 12, l, r, w, top, subs };
}

// The sub-lines under the wide drawing's headers (W1). Left: the review's one group, only when it holds every row, from
// step 5's own affinities; else null. Right: the best rank to the worst cell, both table cells.
export function leftSub(b: BothWays, groups: { name: string; affinity: number }[][] | undefined): string | null {
  if (groups?.length !== 1 || groups[0].length !== b.rows.length) return null;
  const a = groups[0].map((g) => g.affinity);
  return `all ${COUNT[a.length] ?? a.length} score ${Math.min(...a).toFixed(2)} to ${Math.max(...a).toFixed(2)}`;
}
export function rightSub(b: BothWays): string | null {
  const ranks = b.rows.map((r) => r.rev).filter((r) => r !== null);
  const nums = ranks.filter((r) => typeof r === "number");
  if (!nums.length) return null;
  const worst: Rank = ranks.includes("out") ? "out" : Math.max(...nums);
  return `${cell(Math.min(...nums))} to ${cell(worst)}`;
}

