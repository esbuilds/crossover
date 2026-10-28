// The pitch sheet's model: the cached ask's steps plus one appended step, the both-ways rows, so the
// frozen checker (lib/ask/check.ts) gates the pitch line exactly as it gates an answer. Pure over the events and the
// both-ways rows; it never writes to the ask's cache. A line the checker rejects means no pitch sheet.
import type { AskEvent } from "./agent.ts";
import { checkDecision, displayName, nameForDisplay, type Check, type StepRecord } from "./check.ts";
import { decisionEvent, stepsFrom } from "./steps.ts";
import { TOOL_LABEL } from "./sheet.ts";
import type { BothWays } from "./both-rules.ts";
import { pitchLines, pitchPick, type PitchLines } from "./pitch-rules.ts";
import reverse from "../../audit/replay-reverse.json" with { type: "json" };

export const BOTH_WHY = "Each name's fans' own top 50 of the seed's type, one Qloo call per name, computed by code beside the answer.";

export type Pitch = PitchLines & { question: string; seed: string; pick: string; steps: StepRecord[]; check: Check; footnotes: { n: number; label: string; summary: string }[] };

export function pitchModel(events: AskEvent[], both: BothWays | null): Pitch | null {
  const d = decisionEvent(events);
  if (!both?.shown || !d || d.type !== "decision" || !d.check.ok || !d.decision?.calls.length) return null;
  const pick = pitchPick(both.rows);
  const base = stepsFrom(events);
  const review = base.find((s) => s.tool === "review");
  const seed = base.find((s) => s.tool === "resolve")?.output as { type?: string } | undefined;
  const groups = (review?.output as { groups?: { name: string; affinity: number }[][] } | undefined)?.groups ?? [];
  const score = groups.flat().find((g) => nameForDisplay(g.name) === pick?.name)?.affinity;
  if (!pick || !review || score === undefined) return null;
  const n = Math.max(...base.map((s) => s.n)) + 1;
  const summary = `each name's fans' own top 50 of ${both.noun}, one Qloo call per name, computed by code beside the answer.`;
  const steps: StepRecord[] = [...base, { n, tool: "both", why: BOTH_WHY, summary, output: { method: { topN: 50 }, rows: both.rows.map((r) => ({ name: r.name, fwd: r.fwd, rev: r.rev === "out" ? null : r.rev })) } }];
  const lines = pitchLines(both, pick, { first: nameForDisplay(d.decision.calls[0].name), score, artist: seed?.type === "urn:entity:artist", review: review.n, both: n, reverse: reverse.summary });
  const check = checkDecision(lines.decision, steps);
  if (!check.ok) return null;
  return {
    ...lines,
    question: `Who should ${displayName(both.seed)} pitch first?`,
    seed: both.seed,
    pick: pick.name,
    steps,
    check,
    footnotes: steps.map((s) => ({ n: s.n, label: s.tool === "both" ? "Both ways" : (TOOL_LABEL[s.tool] ?? s.tool), summary: s.summary })),
  };
}

