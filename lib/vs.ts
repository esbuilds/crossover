// The /vs page's words, generated in code from the rivals counts (brief-oct13-vs). No Claude, no server imports.
import type { Rivals, RivalRow, VsMap } from "./rivals.ts";
import type { RivalPick } from "./rival.ts";

export type VsState = "split" | "two lists" | "shared-heavy";

const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
// possessive: "Allbirds'" not "Allbirds's"
export const poss = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

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

// the verdict's second sentence, from the map: metros in one side's top five and not the other's, up to three each
// ("Liquid Death leads in Portland, Denver and Austin; Celsius in Miami, Tampa and Dallas."). Same lists as the map's
// "Top markets" line, so the words and the map say one thing.
export function mapLine(a: string, b: string, map: Pick<VsMap, "metrosA" | "metrosB"> | null): string | null {
  if (!map) return null;
  const only = (xs: { name: string }[], ys: { name: string }[]) => xs.filter((m) => !ys.some((y) => y.name === m.name)).slice(0, 3).map((m) => m.name);
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0]);
  const [oa, ob] = [only(map.metrosA, map.metrosB), only(map.metrosB, map.metrosA)];
  if (!oa.length && !ob.length) return `${a} and ${b} share the same top five markets.`;
  if (!ob.length) return `${a} leads in ${list(oa)}; ${poss(b)} top five markets are all in ${poss(a)}.`;
  if (!oa.length) return `${b} leads in ${list(ob)}; ${poss(a)} top five markets are all in ${poss(b)}.`;
  return `${a} leads in ${list(oa)}; ${b} in ${list(ob)}.`;
}

// the rival finder's method line (rival-v2): says exactly how the name was chosen and which field, never "rival" or
// "competitor" as our claim
export function methodLine(seed: string, r: RivalPick): string {
  if (r.kind === "pick") {
    const aff = r.pick.affinity !== null ? ` (${r.pick.affinity.toFixed(2)})` : "";
    const also = r.alternates.length ? ` Also close: ${r.alternates.map((x) => x.name).join(", ")}.` : "";
    const how = r.field === "genre" ? `Closest same-field brand by affinity in ${poss(seed)} top 50` : `Closest brand by affinity in ${poss(seed)} top 50 sharing a Qloo product category (${r.category})`;
    return `${how}: ${r.pick.name}${aff}.${also}`;
  }
  if (r.kind === "broader") return `No brand in ${poss(seed)} top 50 shares its category. Closest in its broader category:`;
  if (r.kind === "brands") return `Closest brands by affinity in ${poss(seed)} list:`;
  return `Qloo's top 50 for ${seed} has no same-field brand. Type one on the right.`;
}

// Which finder line leads (brief-oct12-design ruling 2): a genre pick is our measured claim, so it leads and Qloo's
// competitor line sits under it; a category pick or no pick, and Qloo's own label leads. Non-brand seeds carry no
// Qloo line. The auto-run is the measured pick either way.
export function finderOrder(r: RivalPick): ("measured" | "qloo")[] {
  const qloo = "competitors" in r && r.competitors.length > 0;
  if (!qloo) return ["measured"];
  return r.kind === "pick" && r.field === "genre" ? ["measured", "qloo"] : ["qloo", "measured"];
}

// Qloo's own label, attributed (brief-oct12-rival2 ruling 3): the only place "competitor" may appear on a page
export const COMPETITOR_LABEL = "Tagged by Qloo as competitor brands:";

// empty column copy (shared-heavy pairs can leave one side with nothing past the same-field cut)
export const emptyColumn = (name: string) => `No partner leans ${name} past the same-field cut.`;

export function rankContext(row: RivalRow, a: string, b: string): string {
  const at = (rank: number | null, who: string) => (rank ? `#${rank} in ${poss(who)} list` : `not in ${poss(who)} top 50`);
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
  /\brival/i, /\bcompetitor/i, /\bsimilar brand/i,
  /\bprefer/i, /\bsteal/i, /\bwins?\b/i, /\bowns\b/i, /\bdefect/i, /fans love/i, /%/,
  /\b(women|woman|men|man|female|male|girls?|boys?|kids?|children|toddlers?|moms?|dads?|parents?|millennials?|gen ?z|boomers?|black|white|latin[oax]|hispanic|asian|teens?|seniors?|young|older)\b/i,
];
export function bannedIn(text: string, names: string[]): string[] {
  let t = text.split(COMPETITOR_LABEL).join(" "); // the one exception: Qloo's attributed label
  t = t.replace(/\b(?:Red, White|White Wine|Red, White, Ros[eé])\b/g, " "); // Qloo's wine categories, a colour, not people
  for (const name of [...names].sort((x, y) => y.length - x.length)) t = t.split(name).join(" ");
  return BANNED.flatMap((re) => [...t.matchAll(new RegExp(re.source, `${re.flags}g`))].map((m) => m[0]));
}
