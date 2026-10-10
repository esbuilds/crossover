// Review desk core (PLAN.md section 12, blind round 2 and the Oct 10 signal test), label review-v3 (v2: leader-relative ties; v3: an exact name shared across types is ambiguous).
// Of up to eight proposed partners, which deserve investigation, and on what measured evidence? Pure functions plus
// a fixed-candidate adapter that takes its Qloo scorer as an argument, so everything here runs in tests without the API.
// Rules: forward affinity selects, reverse is context and never combined with it; gaps under GAP are ties; no
// cross-type ranking; a missing result is never a zero; popularity is a reference order, never a correction.
import type { Entity } from "./qloo.ts";
import type { Resolution } from "./resolve.ts";

export const REVIEW_VERSION = "review-v3";
export const GAP = 0.05; // smallest affinity gap read as a difference (probe/VERIFY-3.md section 4)
export const MAX_NAMES = 8;
const EPS = 1e-9;
export const MAX_PICKS = 3;

// Missing-data rule, defined from the Oct 10 rows (probe/VERIFY-3.md, out3/profiles.json):
// 1. floor: Qloo returned these exact doubles for unrelated candidates under unrelated signals (0.7649962877984056
//    27 times across audiences, 0.55405379801747 7 times across age brackets), so they mean "no data".
// 2. shared in call: 3 or more candidates in one call with a bit-identical value (the 0.765 floor hit 3 to 4 per row).
//    Two-way exact ties also happen at ordinary values (Patagonia and Red Bull both 0.8250588496729104), so 2 is not
//    enough on its own.
// 3. repeats across signals: the same scored entity with a bit-identical value under 2 or more different signals
//    (Liquid Death x e.l.f. 0.670650049690628 under four unrelated audiences). In review-v1 this applies to the
//    reverse direction: the seed scored under each candidate's signal.
export const FLOORS: ReadonlySet<number> = new Set([0.7649962877984056, 0.55405379801747]);
export const SHARED_IN_CALL = 3;
export const REPEATS_ACROSS_SIGNALS = 2;

export type Missing = "not returned" | "floor" | "shared in call" | "repeats across signals";
// sameAsForward: a reverse cell that was never fetched because the pair is one type (value stays null, see scoreReverse)
export type Cell = { value: number | null; missing?: Missing; sameAsForward?: true };

export function applyMissingRule(values: (number | null | undefined)[], scope: "one call" | "across signals"): Cell[] {
  const count = new Map<number, number>();
  for (const v of values) if (typeof v === "number") count.set(v, (count.get(v) ?? 0) + 1);
  const limit = scope === "one call" ? SHARED_IN_CALL : REPEATS_ACROSS_SIGNALS;
  return values.map((v): Cell => {
    if (typeof v !== "number") return { value: null, missing: "not returned" };
    if (FLOORS.has(v)) return { value: null, missing: "floor" };
    if ((count.get(v) ?? 0) >= limit) return { value: null, missing: scope === "one call" ? "shared in call" : "repeats across signals" };
    return { value: v };
  });
}

// --- identity ---

export type Ref = { entity_id: string; name: string; type: string; popularity: number; tags: string[] };
export type Identity =
  | { state: "confirmed"; input: string; entity: Ref; via: "exact name" | "chosen id" }
  | { state: "ambiguous"; input: string; options: Ref[] }
  | { state: "unresolved"; input: string }
  | { state: "proxy"; input: string; entity: Ref }; // a stand-in: shown, never measured inside the shortlist

export const toRef = (e: Entity, type = e.types[0]): Ref => ({
  entity_id: e.entity_id,
  name: e.name,
  type,
  popularity: e.popularity,
  tags: e.tags.map((t) => t.name),
});

// Only an exact name match confirms on its own. An LLM-judged match is a suggestion the buyer confirms, so it stays
// ambiguous with the suggestion first.
// review-v3 (held-out audit, Oct 10): an exact name that another known entity of a different type also carries is
// ambiguous, not Qloo's first result (Corona confirmed to the band, Mars to an artist, Ghost and Prime likewise). A
// musician's person and artist entities are one act (the resolver already picks the artist), so they don't count.
const sameName = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]/g, "") === b.toLowerCase().replace(/[^a-z0-9]/g, "");
const KNOWN = 0.3; // the resolver's popularity floor: below it an exact name is usually a namesake
const MUSICIAN = ["urn:entity:artist", "urn:entity:person"];
export function identityOf(input: string, r: Resolution): Identity {
  if (r.status === "confident" && r.via === "exact") {
    const t = r.match.types[0];
    const rivals = r.alternates.filter((e) => sameName(e.name, r.match.name) && e.types[0] !== t && e.popularity >= KNOWN && !(MUSICIAN.includes(t) && MUSICIAN.includes(e.types[0])));
    if (rivals.length) return { state: "ambiguous", input, options: [r.match, ...rivals].map((e) => toRef(e)) };
    return { state: "confirmed", input, entity: toRef(r.match), via: "exact name" };
  }
  if (r.status === "confident") return { state: "ambiguous", input, options: [r.match, ...r.alternates].map((e) => toRef(e)) };
  if (r.status === "ambiguous") return { state: "ambiguous", input, options: r.candidates.map((e) => toRef(e)) };
  return { state: "unresolved", input };
}

// --- fixed-candidate adapter ---

export type Scorer = (params: Record<string, string | number>) => Promise<{ entity_id: string; affinity?: number }[]>;

export const byType = <T extends { type: string }>(xs: T[]) => {
  const groups = new Map<string, T[]>();
  for (const x of xs) groups.set(x.type, [...(groups.get(x.type) ?? []), x]);
  return groups;
};

// Forward: the seed's audience scoring the candidates. One call per entity type (filter.type takes one type, and an
// id of another type is silently dropped), so a mixed list is scored in groups and never ranked across them.
export async function scoreForward(seed: Ref, cands: Ref[], score: Scorer): Promise<Record<string, Cell>> {
  const out: Record<string, Cell> = {};
  for (const [type, group] of byType(cands)) {
    const hits = await score({ "filter.type": type, "signal.interests.entities": seed.entity_id, "filter.results.entities": group.map((c) => c.entity_id).join(","), take: group.length });
    const got = new Map(hits.map((h) => [h.entity_id, h.affinity]));
    applyMissingRule(group.map((c) => got.get(c.entity_id)), "one call").forEach((cell, i) => (out[group[i].entity_id] = cell));
  }
  return out;
}

// Reverse: each candidate's audience scoring the seed, one call each, serial. Same params as fit.ts's single lookup,
// so the cache is shared with triage and the brief's reverse check.
// Only across types: between two entities of one type Qloo's affinity is symmetric (Oct 10, Olipop vs six brands:
// reverse bit-identical to forward every time), so that call would repeat the forward number as if it were a second
// piece of evidence. Across types it differs (Liquid Death -> Metallica 0.820, Metallica -> Liquid Death 0.835).
export async function scoreReverse(seed: Ref, cands: Ref[], score: Scorer): Promise<Record<string, Cell>> {
  const other = cands.filter((c) => c.type !== seed.type);
  const raw: (number | undefined)[] = [];
  for (const c of other) {
    const [hit] = await score({ "filter.type": seed.type, "signal.interests.entities": c.entity_id, "filter.results.entities": seed.entity_id, take: 1 });
    raw.push(hit?.entity_id === seed.entity_id ? hit.affinity : undefined);
  }
  const cells = applyMissingRule(raw, "across signals");
  return Object.fromEntries(
    cands.map((c): [string, Cell] => [c.entity_id, c.type === seed.type ? { value: null, sameAsForward: true } : cells[other.indexOf(c)]]),
  );
}

// --- ties, selection, evidence ---

// Highest first, leader-relative (review-v2): a band is its strongest member plus everything within GAP of it; the
// next band starts at the first value GAP or more below that leader. No order is claimed inside a band. Chaining
// steps (review-v1) collapsed whole lists into one tie, since every step was under GAP.
export function bands<T>(xs: T[], value: (x: T) => number): T[][] {
  const sorted = [...xs].sort((a, b) => value(b) - value(a));
  const out: T[][] = [];
  // EPS: 0.95 - 0.90 is 0.0499999... in floating point; a gap of exactly GAP is a difference, every time
  sorted.forEach((x) => (out.length && value(out.at(-1)![0]) - value(x) < GAP - EPS ? out.at(-1)!.push(x) : out.push([x])));
  return out;
}

export type Row = { id: string; forward: number | null };
export type Selection = { picks: string[]; tiedAtCutoff: string[]; noClearThree: boolean };

// Up to MAX_PICKS by forward affinity, only above a clear break (a step of at least GAP). When ties straddle the
// cutoff, the picks stop short and the tied band is named instead: fewer than three is allowed, a coin flip is not.
// A top band of four or more is "no clear three": no picks, the band is shown with its gaps.
export function select(rows: Row[]): Selection {
  const measured = rows.filter((r): r is { id: string; forward: number } => r.forward !== null);
  const bs = bands(measured, (r) => r.forward);
  const picks: string[] = [];
  for (const b of bs.slice(0, -1)) {
    // the last band has no break below it, so it is never picked as a whole
    if (picks.length + b.length > MAX_PICKS) break;
    picks.push(...b.map((r) => r.id));
  }
  const next = picks.length < MAX_PICKS ? bs.find((b) => !picks.includes(b[0].id)) : undefined;
  return { picks, tiedAtCutoff: next && next.length > 1 ? next.map((r) => r.id) : [], noClearThree: (bs[0]?.length ?? 0) > MAX_PICKS };
}

export type Evidence = "stronger measured support" | "mixed directional evidence" | "weaker measured support" | "insufficient evidence";
type Level = "high" | "level" | "low" | "unknown";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// Reverse is read against the group's own median, by the same GAP. It can flag a disagreement; it never moves a pick.
export function reverseLevels(rows: { id: string; reverse: number | null }[]): Record<string, Level> {
  const known = rows.flatMap((r) => (r.reverse === null ? [] : [r.reverse]));
  const m = known.length >= 2 ? median(known) : null;
  return Object.fromEntries(
    rows.map((r) => [r.id, r.reverse === null || m === null ? "unknown" : r.reverse - m >= GAP ? "high" : m - r.reverse >= GAP ? "low" : "level"]),
  );
}

// Within one type group of this shortlist. Selection here runs on every measured candidate (buyer gates don't change
// what Qloo measured). A band tied at the cutoff can't be placed either way, so it is insufficient, with the gap shown.
export function evidenceFor(rows: (Row & { reverse: number | null })[]): Record<string, Evidence> {
  const measured = rows.filter((r) => r.forward !== null);
  const { picks, tiedAtCutoff } = select(rows);
  const rev = reverseLevels(rows);
  return Object.fromEntries(
    rows.map((r): [string, Evidence] => {
      if (r.forward === null || measured.length < 2 || tiedAtCutoff.includes(r.id)) return [r.id, "insufficient evidence"];
      if (picks.includes(r.id)) return [r.id, rev[r.id] === "low" ? "mixed directional evidence" : "stronger measured support"];
      return [r.id, rev[r.id] === "high" ? "mixed directional evidence" : "weaker measured support"];
    }),
  );
}

// --- request hygiene (adversarial pass, Oct 10) ---

// A buyer object from a request body, reduced to what gateFor reads. Anything else is dropped, never trusted.
export function parseBuyer(raw: unknown): Buyer {
  const b = (raw ?? {}) as { exclude?: unknown; excludeTags?: unknown };
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
  const exclude = (Array.isArray(b.exclude) ? b.exclude : []).slice(0, 20).flatMap((x) => {
    const name = text((x as { name?: unknown })?.name, 100);
    return name ? [{ name, reason: text((x as { reason?: unknown })?.reason, 200) ?? "excluded by the buyer" }] : [];
  });
  const excludeTags = (Array.isArray(b.excludeTags) ? b.excludeTags : []).slice(0, 10).flatMap((t) => (text(t, 50) ? [text(t, 50)!] : []));
  return { exclude, excludeTags };
}

// The same entity twice (typed twice, or two spellings that resolve alike) is measured once, under its first input.
export function dedupe(ids: Identity[]): Identity[] {
  const seen = new Set<string>();
  return ids.filter((i) => i.state !== "confirmed" || (!seen.has(i.entity.entity_id) && !!seen.add(i.entity.entity_id)));
}

// --- buyer gates ---

export type Buyer = { exclude?: { name: string; reason: string }[]; excludeTags?: string[] };
export type Gate = { state: "excluded"; reason: string } | { state: "eligible" } | { state: "unknown"; reason: string };

// Named exclusions and tag exclusions are hard gates. A tag rule can't be checked on an entity with no Qloo tags, so
// that stays unknown (and eligible for selection) rather than passing silently. Copy says "where Qloo tags it".
export function gateFor(ref: Ref, input: string, buyer: Buyer): Gate {
  const named = buyer.exclude?.find((x) => [input, ref.name].some((n) => n.trim().toLowerCase() === x.name.trim().toLowerCase()));
  if (named) return { state: "excluded", reason: named.reason };
  const rules = buyer.excludeTags ?? [];
  if (!rules.length) return { state: "eligible" };
  if (!ref.tags.length) return { state: "unknown", reason: `Qloo has no tags for ${ref.name}, so "${rules.join('", "')}" can't be checked` };
  // Whole words, not substrings ("ale" must not catch "Retail"), and the reason quotes Qloo's own tag, so a rule
  // like "beer" catching "Root Beer" is visible to the buyer rather than hidden behind the rule's word.
  const word = (rule: string) => new RegExp(`\\b${rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  for (const rule of rules) {
    const tag = ref.tags.find((t) => word(rule).test(t));
    if (tag) return { state: "excluded", reason: `Qloo tags it ${tag}` };
  }
  return { state: "eligible" };
}

// --- assembly ---

export type ReviewRow = {
  input: string;
  entity: Ref;
  forward: Cell;
  reverse: Cell;
  popularity: number;
  evidence: Evidence;
  gate: Gate;
};
export type ReviewGroup = {
  type: string;
  rows: ReviewRow[]; // forward affinity order, missing last
  selection: Selection; // eligible candidates only
  affinityBands: string[][]; // entity ids, ties grouped, missing left out
  popularityBands: string[][]; // reference order on the same shortlist, labelled popularity
};
export type Review = { version: string; gap: number; seed: Ref; groups: ReviewGroup[]; notMeasured: Identity[] };

export function assemble(seed: Ref, ids: Identity[], forward: Record<string, Cell>, reverse: Record<string, Cell>, buyer: Buyer = {}): Review {
  const measured = ids.filter((i): i is Extract<Identity, { state: "confirmed" }> => i.state === "confirmed");
  const groups = [...byType(measured.map((i) => ({ ...i, type: i.entity.type })))].map(([type, members]): ReviewGroup => {
    const base = members.map((i) => ({ i, id: i.entity.entity_id, forward: forward[i.entity.entity_id]?.value ?? null, reverse: reverse[i.entity.entity_id]?.value ?? null }));
    const gates = Object.fromEntries(base.map((b) => [b.id, gateFor(b.i.entity, b.i.input, buyer)]));
    const eligible = base.filter((b) => gates[b.id].state !== "excluded");
    // Eligible rows are read against the same pool the picks come from, so a pick never shows as a tie (Red Bull,
    // Oct 10: excluded Monster Energy chained GoPro, Oakley and Nike into one band). Excluded rows keep their reading
    // against everything Qloo measured.
    const evidence = { ...evidenceFor(base), ...evidenceFor(eligible) };
    const rows = base
      .map((b): ReviewRow => ({
        input: b.i.input,
        entity: b.i.entity,
        forward: forward[b.id] ?? { value: null, missing: "not returned" },
        reverse: reverse[b.id] ?? { value: null, missing: "not returned" },
        popularity: b.i.entity.popularity,
        evidence: evidence[b.id],
        gate: gates[b.id],
      }))
      .sort((a, b) => (b.forward.value ?? -1) - (a.forward.value ?? -1));
    const known = base.filter((b): b is typeof b & { forward: number } => b.forward !== null);
    return {
      type,
      rows,
      selection: select(eligible),
      affinityBands: bands(known, (b) => b.forward).map((band) => band.map((b) => b.id)),
      popularityBands: bands(base, (b) => b.i.entity.popularity).map((band) => band.map((b) => b.id)),
    };
  });
  return { version: REVIEW_VERSION, gap: GAP, seed, groups, notMeasured: ids.filter((i) => i.state !== "confirmed") };
}

// Display: two decimals of the 0-1 score, never a percentage or a probability, never a zero for a missing result.
export const formatAffinity = (c: Cell) => (c.value === null ? "no measurement" : c.value.toFixed(2));
