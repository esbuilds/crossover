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

export const OUT = 51; // "not in their top 50", for the gate's arithmetic only
export type Rank = number | "out" | null; // null: no measurement (never fetched), never shown as a blank
export type Row = { name: string; fwd: Rank; rev: Rank; call: boolean };
export type BothWays = { seed: string; noun: string; rows: Row[]; sentence: string | null };
type Get = (p: Record<string, string | number>) => Promise<Entity[]>;

const ORD = ["first", "second", "third"];
const NOUN: Record<string, string> = { "urn:entity:brand": "brands", "urn:entity:artist": "artists" };

export function gate(rows: Row[]): boolean {
  const calls = rows.filter((r) => r.call);
  const at = (r: Rank) => (typeof r === "number" ? r : OUT);
  const revs = calls.map((r) => at(r.rev));
  if (calls.length < 2 || Math.max(...revs) - Math.min(...revs) < 5) return false;
  const byRev = [...rows].sort((x, y) => at(x.rev) - at(y.rev));
  return calls.some((r, i) => byRev[i] !== r);
}

export function sentence(seed: string, noun: string, first: Row | undefined): string | null {
  return first && typeof first.rev === "number" && first.rev <= 3 ? `${first.name} fans rank ${seed} ${ORD[first.rev - 1]} among ${noun}.` : null;
}

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
  if (!gate(rows)) return null;
  const noun = NOUN[seed.type] ?? "names";
  return { seed: seed.name, noun, rows, sentence: sentence(seed.name, noun, rows.find((r) => r.name === calls[0])) };
}

const must = <T,>(v: T | null): T => { if (v === null) throw new Cold(); return v; };

// ip null: cache only, never a call (the sheet). A cold ask spends one of the visitor's cold allowances, then up to 8 calls.
export function bothWays(events: AskEvent[], ip: string | null): Promise<BothWays | null> {
  const run = (mode: "peek" | "live") => bothWaysFrom(events, (p) => (mode === "peek" ? insights.peek(p).then(must) : insights(p)) as Promise<Entity[]>);
  if (ip === null) return run("peek").catch((e) => { if (e instanceof Cold) return null; throw e; });
  return warmFirst(run, () => spendColdPair(ip));
}
