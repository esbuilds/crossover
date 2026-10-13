// lib/ask/candidates.ts
// The ask agent's eight candidates, by rule (the model chooses the source, never the names).
// "split": the seed's column of the rivals split, widest gap first. "top50": the seed's fans' top 50 brands in
// affinity order, minus the seed, the rival and anything in the seed's own field (the rivals fields rule).
import type { Entity } from "../qloo.ts";
import { fields, type RivalRow } from "../rivals.ts";

export type Candidate = { id: string; name: string };
export const CANDIDATES = 8;

export const fromSplit = (leans: RivalRow[]): Candidate[] => leans.slice(0, CANDIDATES).map((r) => ({ id: r.id, name: r.name }));

export function fromTop50(seed: Entity, list: Entity[], exclude: string[]): Candidate[] {
  const own = fields(seed);
  return list
    .filter((x) => x.entity_id !== seed.entity_id && !exclude.includes(x.entity_id) && ![...fields(x)].some((f) => own.has(f)))
    .slice(0, CANDIDATES)
    .map((x) => ({ id: x.entity_id, name: x.name }));
}
