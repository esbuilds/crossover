// The /vs page's words, generated in code from the rivals counts (brief-oct13-vs). No Claude, no server imports.
import type { Rivals, RivalRow } from "./rivals.ts";

export type VsState = "split" | "two lists" | "shared-heavy";

const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

export function vsState(r: Rivals): VsState {
  if (r.layout === "two") return "two lists";
  // the columns are mostly shared and one side is thin (Olipop vs Poppi, Dodgers vs Yankees)
  if (r.shared.length > r.leansA.length + r.leansB.length && Math.min(r.leansA.length, r.leansB.length) < 3) return "shared-heavy";
  return "split";
}

export function verdict(r: Rivals): string[] {
  const total = r.leansA.length + r.leansB.length + r.shared.length + r.sameField.length + r.noData.length;
  const sit = (k: number) => `${k} ${k === 1 ? "sits" : "sit"}`;
  const lines = [`Of ${total} candidates, ${sit(r.leansA.length)} closer to ${r.a.name}, ${r.leansB.length} closer to ${r.b.name} and ${r.shared.length} within 0.05 of both.`];
  const aside = [r.sameField.length ? `${n(r.sameField.length, "brand")} in their own field ${r.sameField.length === 1 ? "is" : "are"} set aside below` : "", r.noData.length ? `${r.noData.length} had no data` : ""].filter(Boolean);
  if (aside.length) lines[0] += ` ${aside.join("; ")}.`;
  const state = vsState(r);
  if (state === "two lists") lines.push(`These two audiences barely overlap: ${r.shared.length} of ${total} candidates sit within 0.05 of both.`);
  if (state === "shared-heavy") {
    const cols = r.leansA.length + r.leansB.length + r.shared.length;
    lines.push(`These two read as one audience: ${r.shared.length} of ${cols} candidates outside their own field sit within 0.05 of both. The map may still split.`);
  }
  return lines;
}

// empty column copy (shared-heavy pairs can leave one side with nothing past the same-field cut)
export const emptyColumn = (name: string) => `No partner leans ${name} past the same-field cut.`;

export function rankContext(row: RivalRow, a: string, b: string): string {
  const at = (rank: number | null, who: string) => (rank ? `#${rank} in ${who}'s list` : `not in ${who}'s top 50`);
  return row.rankA && !row.rankB ? `${at(row.rankA, a)}, ${at(null, b)}` : row.rankB && !row.rankA ? `${at(row.rankB, b)}, ${at(null, a)}` : `${at(row.rankA, a)}, ${at(row.rankB, b)}`;
}

export const DOESNT_ESTABLISH = [
  "No purchase data: every number is Qloo taste affinity.",
  "No audience size: a long column is not a bigger market.",
  "No commercial eligibility: Qloo can't say whether a brand will partner.",
  "A lean is a taste gap of 0.05 or more in one scoring call, not a recommendation.",
  "A brand whose category tag sits past Qloo's tag cut can appear in a column instead of under same field.",
];

// Copy rules, checked over the rendered page in tests and on production (entity names stripped first: "Pretty Girls
// Sweat" is a name, not our words). "audience" stays: the brief's own state lines use it about the overlap.
export const BANNED = [
  /\bprefer/i, /\bsteal/i, /\bwins?\b/i, /\bowns\b/i, /\bdefect/i, /fans love/i, /%/,
  /\b(women|woman|men|man|female|male|girls?|boys?|kids?|children|toddlers?|moms?|dads?|parents?|millennials?|gen ?z|boomers?|black|white|latin[oax]|hispanic|asian|teens?|seniors?|young|older)\b/i,
];
export function bannedIn(text: string, names: string[]): string[] {
  let t = text;
  for (const name of [...names].sort((x, y) => y.length - x.length)) t = t.split(name).join(" ");
  return BANNED.flatMap((re) => [...t.matchAll(new RegExp(re.source, `${re.flags}g`))].map((m) => m[0]));
}
