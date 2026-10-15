// Both ways (Fable's columns ruling, real Oct 15): for the eight, the seed's fans' rank of each (the frozen review's
// forward rank, the tie unrounded) beside each one's fans' rank of the seed (a different list: that brand's fans' own top
// 50 of the seed's type). The only measurement on the probe that separates the eight (scripts/reverse-probe.ts:
// Bombas fans rank Allbirds 1st, Parachute's 31st). Evidence beside the frozen decision, never a second decision: rows
// keep the review's order and nothing is reordered. Gate as the probe: the agent's three differ by 5+ reverse positions
// and the reverse order isn't the forward order, else no block.
import { insights, type Entity } from "../qloo.ts";
import { Cold, warmFirst } from "../review-run.ts";
import { spendColdPair } from "../rivals.ts";
import type { AskEvent } from "./agent.ts";
import { nameForDisplay } from "./check.ts";
import { decisionEvent, stepsFrom } from "./steps.ts";

import { gate, NOUN, oneWay, sentence, type BothWays, type Row } from "./both-rules.ts";
export * from "./both-rules.ts";
type Get = (p: Record<string, string | number>) => Promise<Entity[]>;

// Pure over the ask's events and a Qloo getter, so tests run without the API.
export async function bothWaysFrom(events: AskEvent[], get: Get): Promise<BothWays | null> {
  const steps = stepsFrom(events);
  const d = decisionEvent(events);
  const calls = d && d.type === "decision" && d.check.ok ? (d.decision?.calls ?? []).map((c) => nameForDisplay(c.name)) : [];
  const seed = steps.find((s) => s.tool === "resolve")?.output as { name?: string; id?: string; type?: string } | undefined;
  const cands = (steps.find((s) => s.tool === "candidates")?.output as { candidates?: { name: string; id: string }[] } | undefined)?.candidates ?? [];
  const ranks = (steps.find((s) => s.tool === "review")?.output as { ranks?: { name: string; amongSeedFans: number | null }[] } | undefined)?.ranks ?? [];
  if (!calls.length || !seed?.id || !seed.type || !seed.name || !ranks.length) return null;
  const rows: Row[] = [];
  for (const r of ranks) {
    const c = cands.find((x) => x.name === r.name);
    if (!c) return null;
    const list = await get({ "filter.type": seed.type, "signal.interests.entities": c.id, take: 50 });
    const at = list.findIndex((e) => e.entity_id === seed.id) + 1;
    // tools.ts collapses "never fetched" and "not in the top 50" into null; the block can't tell them apart, so says so
    rows.push({ name: nameForDisplay(r.name), fwd: r.amongSeedFans ?? null, rev: at || "out", call: calls.includes(nameForDisplay(r.name)) });
  }
  const noun = NOUN[seed.type] ?? "names";
  const first = rows.find((r) => r.name === calls[0]);
  if (!gate(rows)) return { seed: seed.name, noun, rows, shown: false, sentence: null, oneWay: null };
  return { seed: seed.name, noun, rows, shown: true, sentence: sentence(seed.name, noun, first), oneWay: oneWay(seed.name, noun, rows, first) };
}

const must = <T,>(v: T | null): T => { if (v === null) throw new Cold(); return v; };

// ip null: cache only, never a call (the sheet). A cold ask spends one of the visitor's cold allowances, then up to 8 calls.
export function bothWays(events: AskEvent[], ip: string | null): Promise<BothWays | null> {
  const run = (mode: "peek" | "live") => bothWaysFrom(events, (p) => (mode === "peek" ? insights.peek(p).then(must) : insights(p)) as Promise<Entity[]>);
  if (ip === null) return run("peek").catch((e) => { if (e instanceof Cold) return null; throw e; });
  return warmFirst(run, () => spendColdPair(ip));
}
