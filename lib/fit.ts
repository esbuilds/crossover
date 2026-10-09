// Fit in one direction: where an entity lands among another entity's fans, within its own category.
// Raw pairwise affinity is inflated by popularity (PLAN.md section 3, pairing row: Liquid Death to Metallica and
// to Taylor Swift both score 0.82), so fit is reported as a rank in the fans' own top 50, with cutoffs for context.
// Shared by the slate's mutual badges, the brief's reverse check, and pairing mode, with identical Qloo params so
// they share cache entries.
import { insights } from "./qloo.ts";

export type Target = { entity_id: string; type: string };
export type Direction = {
  rank: number | null; // 1-50, or null when outside the fans' top 50
  affinity: number | null;
  top10Cutoff: number | null;
  top50Cutoff: number | null;
  top5: string[]; // the fans' top five in that category, for context
  tags: string[]; // the target's Qloo tags
};

// The fans' top 50 in a category. 1 Qloo call, cached 30 days.
export const fansTop50 = (category: string, fansOf: string) => insights({ "filter.type": category, "signal.interests.entities": fansOf, take: 50 });

// Where target lands among fansOf's fans. 1 call, plus 1 for the raw affinity only when target is outside the top 50.
export async function rankAmongFans(target: Target, fansOf: string): Promise<Direction> {
  const list = await fansTop50(target.type, fansOf);
  const at = list.findIndex((e) => e.entity_id === target.entity_id);
  const entity =
    at >= 0
      ? list[at]
      : (await insights({ "filter.type": target.type, "signal.interests.entities": fansOf, "filter.results.entities": target.entity_id, take: 1 }))[0];
  return {
    rank: at >= 0 ? at + 1 : null,
    affinity: entity?.affinity ?? null,
    top10Cutoff: list[9]?.affinity ?? null,
    top50Cutoff: list.at(-1)?.affinity ?? null,
    top5: list.slice(0, 5).map((e) => e.name),
    tags: entity?.tags.map((t) => t.name) ?? [],
  };
}

// Slate badge: does the partner's audience like the seed back?
export const badgeFor = (rank: number | null): "mutual" | "partial" | null => (rank === null ? null : rank <= 10 ? "mutual" : "partial");

// Pairing verdict, decided in code so the model writes about a call it didn't make:
// both directions inside the fans' top 50 is an affinity play; exactly one is one-way; neither is a contrast play.
export type PairKind = "affinity" | "one-way" | "contrast";
export function classify(aAmongBFans: number | null, bAmongAFans: number | null): { kind: PairKind; strongSide?: "a" | "b" } {
  const a = aAmongBFans !== null;
  const b = bAmongAFans !== null;
  if (a && b) return { kind: "affinity" };
  if (a || b) return { kind: "one-way", strongSide: b ? "b" : "a" }; // strongSide: whose fans love the other
  return { kind: "contrast" };
}
