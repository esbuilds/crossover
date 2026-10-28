// lib/review-run.ts
// The review desk's run, shared by POST /api/review and the ask agent: forward and reverse scores, the assembled
// groups, ranks read from the cache only (never a call), and twins per group. Serial against Qloo.
import { insights } from "./qloo.ts";
import { assemble, contendersOf, scoreForward, scorePairs, scoreReverse, twinsOf, type Buyer, type Identity, type Ref, type Review, type Scorer, type Twins } from "./review.ts";

export type Ranks = Record<string, { amongSeedFans?: number | null; seedAmongTheirs?: number | null }>;
export type ReviewRun = Review & { ranks: Ranks; twins: Record<string, Twins> };
type Peek = (p: Record<string, string | number>) => Promise<{ entity_id: string }[] | null>;

const qlooScore: Scorer = (p) => insights(p);
const qlooPeek: Peek = (p) => insights.peek(p);

export async function twinsFor(group: Review["groups"][number], score: Scorer = qlooScore): Promise<Twins | null> {
  const ids = contendersOf(group.selection, group.affinityBands);
  if (ids.length < 3) return null;
  return twinsOf(ids, await scorePairs(ids.map((id) => group.rows.find((r) => r.entity.entity_id === id)!.entity), score));
}

export async function runReview(seed: Ref, kept: Identity[], buyer: Buyer = {}, opts: { score?: Scorer; peek?: Peek; withTwins?: boolean } = {}): Promise<ReviewRun> {
  const score = opts.score ?? qlooScore, peek = opts.peek ?? qlooPeek;
  const measured = kept.flatMap((i) => (i.state === "confirmed" ? [i.entity] : []));
  const forward = await scoreForward(seed, measured, score);
  const reverse = await scoreReverse(seed, measured, score);
  const rankIn = async (category: string, fansOf: string, id: string) => {
    const list = await peek({ "filter.type": category, "signal.interests.entities": fansOf, take: 50 });
    return list ? list.findIndex((e) => e.entity_id === id) + 1 || null : undefined;
  };
  const ranks: Ranks = {};
  for (const m of measured) ranks[m.entity_id] = { amongSeedFans: await rankIn(m.type, seed.entity_id, m.entity_id), seedAmongTheirs: await rankIn(seed.type, m.entity_id, seed.entity_id) };
  const review = assemble(seed, kept, forward, reverse, buyer);
  const twins: Record<string, Twins> = {};
  if (opts.withTwins !== false)
    for (const g of review.groups) {
      const t = await twinsFor(g, score);
      if (t) twins[g.type] = t;
    }
  return { ...review, ranks, twins };
}

// Cold-first runs (since Oct 13): try the whole run from the cache; only if some piece is cold, spend the
// visitor's cold allowance (the /vs pair cap) and run live. Pieces signal "not cached" by throwing Cold.
export class Cold extends Error {}
export async function warmFirst<T>(run: (mode: "peek" | "live") => Promise<T>, spend: () => Promise<void>): Promise<T> {
  try {
    return await run("peek");
  } catch (e) {
    if (!(e instanceof Cold)) throw e;
  }
  await spend();
  return run("live");
}
