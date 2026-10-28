// Smaller names, nearly the same fit: the seed's fans' brand list read twice, as
// is and with Qloo's popularity capped (filter.popularity.max), and the capped names that sit within 0.05 of the
// strongest name, the product's own tie rule. Evidence beside the frozen decision, never a second decision. Gate run
// Oct 18 (audit/popularity-probe.json): affinity is the same number in both reads, so the comparison holds.
import { insights, type Entity } from "../qloo.ts";
import { Cold, warmFirst } from "../review-run.ts";
import { spendColdPair } from "../rivals.ts";
import type { AskEvent } from "./agent.ts";
import { stepsFrom } from "./steps.ts";

import { CAP, GAP, type Row, type Smaller } from "./smaller-rules.ts";
export * from "./smaller-rules.ts";
type Get = (p: Record<string, string | number>) => Promise<Entity[]>;

const row = (e: Entity): Row => ({ name: e.name, affinity: e.affinity ?? 0, popularity: e.popularity });

// Pure over the seed and a Qloo getter, so tests run without the API.
export async function smallerFrom(seed: { id: string; name: string }, get: Get): Promise<Smaller | null> {
  const base = { "filter.type": "urn:entity:brand", "signal.interests.entities": seed.id, take: 20 };
  // the leader needs a popularity reading too, or the line would print Qloo's "no measurement" 0 as a number
  const all = (await get(base)).filter((e) => e.entity_id !== seed.id && e.affinity != null && e.popularity > 0);
  if (!all.length) return null;
  const leader = row(all[0]);
  const capped = (await get({ ...base, "filter.popularity.max": CAP }))
    // popularity 0 is Qloo's "no measurement", not "unknown brand": those rows pass any cap untested, so they're left out
    .filter((e) => e.entity_id !== seed.id && e.affinity != null && e.popularity > 0 && e.popularity <= CAP);
  return { seed: seed.name, cap: CAP, leader, rows: capped.map(row).filter((r) => leader.affinity - r.affinity <= GAP + 1e-9).slice(0, 5) };
}

export function seedOf(events: AskEvent[]) {
  const s = stepsFrom(events).find((x) => x.tool === "resolve")?.output as { state?: string; name?: string; id?: string } | undefined;
  return s?.state === "confirmed" && s.id && s.name ? { id: s.id, name: s.name } : null;
}

// ip null: cache only, never a call. A cold seed spends one of the visitor's cold allowances, then 2 calls.
export function smaller(events: AskEvent[], ip: string | null): Promise<Smaller | null> {
  const seed = seedOf(events);
  if (!seed) return Promise.resolve(null);
  const must = <T,>(v: T | null): T => { if (v === null) throw new Cold(); return v; };
  const run = (mode: "peek" | "live") => smallerFrom(seed, (p) => (mode === "peek" ? insights.peek(p).then(must) : insights(p)) as Promise<Entity[]>);
  if (ip === null) return run("peek").catch((e) => { if (e instanceof Cold) return null; throw e; });
  return warmFirst(run, () => spendColdPair(ip));
}
