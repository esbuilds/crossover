// The three step pictures on the ask page (Pick A, Oct 13), shaped from an ask's events. Pure and server-free: the page
// draws them with existing components; every value here is already in a step output the checker reads.
import type { AskEvent } from "./agent.ts";
import type { StepRecord } from "./check.ts";

type Named = { name: string; id?: string; type?: string };

export function stepsFrom(events: AskEvent[]): StepRecord[] {
  const out = new Map<number, StepRecord>();
  for (const e of events) {
    if (e.type === "call") out.set(e.n, { n: e.n, tool: e.tool, why: e.why, output: undefined, summary: "" });
    if (e.type === "result") {
      const s = out.get(e.n);
      if (s) Object.assign(s, { output: e.output, summary: e.summary });
    }
  }
  return [...out.values()].sort((a, b) => a.n - b.n);
}

const outputOf = <T>(steps: StepRecord[], tool: string) => steps.find((s) => s.tool === tool && s.output && !(s.output as { error?: string }).error)?.output as T | undefined;

export type MapStep = { href: string; seed: Named; rival: Named; closerToSeed: number; closerToRival: number; withinGapOfBoth: number; seedMarkets: string[]; rivalMarkets: string[] };

export function mapStep(steps: StepRecord[]): MapStep | null {
  const o = outputOf<{ seed: Named; rival: Named; closerToSeed: number; closerToRival: number; withinGapOfBoth: number; seedMarkets: Named[]; rivalMarkets: Named[] }>(steps, "split");
  if (!o?.seed?.id || !o.rival?.id) return null;
  const q = new URLSearchParams({ ta: o.seed.type!, tb: o.rival.type! });
  return {
    href: `/vs/${o.seed.id}/${o.rival.id}?${q}`,
    seed: o.seed, rival: o.rival,
    closerToSeed: o.closerToSeed, closerToRival: o.closerToRival, withinGapOfBoth: o.withinGapOfBoth,
    seedMarkets: o.seedMarkets.map((m) => m.name), rivalMarkets: o.rivalMarkets.map((m) => m.name),
  };
}

export type Card = { name: string; id: string; affinity: number | null; fameBand: number };
export type CardsStep = { cards: Card[]; fameFlat: boolean };

export function cardsStep(steps: StepRecord[]): CardsStep | null {
  const r = outputOf<{ groups: { name: string; affinity: number }[][]; fameBands: Named[][]; notMeasured: Named[] }>(steps, "review");
  const c = outputOf<{ candidates: Named[] }>(steps, "candidates");
  if (!r || !c) return null;
  const idOf = (name: string) => c.candidates.find((x) => x.name === name)?.id ?? "";
  const bandOf = (name: string) => r.fameBands.findIndex((band) => band.some((x) => x.name === name));
  const cards: Card[] = [
    ...r.groups.flat().map((x) => ({ name: x.name, id: idOf(x.name), affinity: x.affinity, fameBand: bandOf(x.name) })),
    ...r.notMeasured.map((x) => ({ name: x.name, id: idOf(x.name), affinity: null, fameBand: bandOf(x.name) })),
  ];
  // the Pick three reveal's rule (app/review/review-view.tsx): at most one name outside the best-known band, and taste
  // splits into more than one group
  const fameFlat = cards.length >= 4 && (r.fameBands[0]?.length ?? 0) >= cards.length - 1 && r.groups.length > 1;
  return { cards, fameFlat };
}

export type TwinsStep = { a: string; b: string; value: number; next: number };

export function twinsStep(steps: StepRecord[]): TwinsStep | null {
  const o = outputOf<{ found: boolean; a?: Named; b?: Named; value?: number; next?: number }>(steps, "twins");
  return o?.found && o.a && o.b ? { a: o.a.name, b: o.b.name, value: o.value!, next: o.next! } : null;
}

// Under the decision (Fable round 5 ruling 1): the two frozen replay tests, each its own number; pooled stays on /audit.
type Tally = { hits: number; scored: number };
export const replayLine = (v1: Tally, v2: Tally) =>
  `Against real deals it never saw, the protocol put the real partner in the top three ${v1.hits} of ${v1.scored} times (v1) and ${v2.hits} of ${v2.scored} times (v2). Each is a frozen test; details on /audit.`;

// Step 5's dumbbell (Pick 1, Oct 14): fame (Qloo popularity) at one end, taste (affinity) at the other, one row per
// candidate, the widest taste-over-fame gap first. A popularity of 0 is Qloo's missing value (lib/qloo.ts trims a missing
// popularity to 0), so it reads as no measurement and sorts after the measured rows, never as the widest gap (Quince,
// Allbirds' eight, Oct 14). Unmeasured taste last. null for asks cached before popularity joined the review output.
export type DumbbellRow = { name: string; fame: number | null; taste: number | null };
export function dumbbellStep(steps: StepRecord[]): { rows: DumbbellRow[] } | null {
  const r = outputOf<{ groups: { name: string; affinity: number; popularity?: number }[][]; notMeasured?: Named[] }>(steps, "review");
  const measured = r?.groups.flat() ?? [];
  if (!r || !measured.length || measured.some((x) => x.popularity == null)) return null;
  const rows: DumbbellRow[] = measured.map((x) => ({ name: x.name, fame: x.popularity! > 0 ? x.popularity! : null, taste: x.affinity }));
  const known = rows.filter((x) => x.fame !== null).sort((a, b) => b.taste! - b.fame! - (a.taste! - a.fame!));
  const noFame = rows.filter((x) => x.fame === null).sort((a, b) => b.taste! - a.taste!);
  return { rows: [...known, ...noFame, ...(r.notMeasured ?? []).map((x) => ({ name: x.name, fame: null, taste: null }))] };
}
