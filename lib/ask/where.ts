// Server only. "Where to start" for a cached ask: the market (the card's lead city when a split exists, else the seed's
// top heatmap market) and the venues both the seed's and the first call's fans favor there. Cache first; a cold lookup
// spends the visitor's cold allowance like a new pair (lib/review-run.ts warmFirst). Never touches the frozen answer.
import { heatmap, insights, type Entity } from "../qloo.ts";
import { buildCities } from "../cities.ts";
import { spendColdPair } from "../rivals.ts";
import { Cold, warmFirst } from "../review-run.ts";
import type { AskEvent } from "./agent.ts";
import { nameForDisplay } from "./check.ts";
import { decisionEvent, mapStep, stepsFrom } from "./steps.ts";
import { venueLine, venuesIn } from "./venues.ts";

const must = <T,>(v: T | null): T => { if (v === null) throw new Cold(); return v; };

export async function whereToStart(events: AskEvent[], ip: string | null): Promise<{ market: string; line: string | null } | null> {
  const steps = stepsFrom(events);
  const d = decisionEvent(events);
  const first = d && d.type === "decision" && d.check.ok ? d.decision?.calls[0] : undefined;
  const seed = steps.find((s) => s.tool === "resolve")?.output as { name?: string; id?: string; type?: string } | undefined;
  const cands = (steps.find((s) => s.tool === "candidates")?.output as { candidates?: { name: string; id: string }[] } | undefined)?.candidates ?? [];
  const pickName = first ? nameForDisplay(first.name) : null;
  const pick = cands.find((c) => nameForDisplay(c.name) === pickName);
  if (!first || !seed?.id || !seed.type || !pick) return null;
  const m = mapStep(steps);
  const own = m ? m.seedMarkets.filter((x) => !m.rivalMarkets.includes(x)) : [];
  // ip null: cache only, never a call (the sheet and previews)
  const run = async (mode: "peek" | "live") => {
    const get = (p: Record<string, string | number>) => (mode === "peek" ? insights.peek(p).then(must) : insights(p)) as Promise<Entity[]>;
    const market = own[0] ?? buildCities(mode === "peek" ? must(await heatmap.peek(seed.id!, "United States")) : await heatmap(seed.id!, "United States")).metros[0]?.name;
    if (!market) return null;
    const venues = await venuesIn({ seedId: seed.id!, pickId: pick.id, market, artist: seed.type === "urn:entity:artist" }, get);
    return { market, line: venueLine(market, seed.name ?? "", pickName!, venues) };
  };
  if (ip === null) return run("peek").catch((e) => { if (e instanceof Cold) return null; throw e; });
  return warmFirst(run, () => spendColdPair(ip));
}
