// The call sheet (Pick 2, Oct 14): one printed page a partnerships lead forwards, drawn from a cached ask only. Every
// sentence on it is one the checker already passed, a code-generated line from the step outputs, or static text; the
// numbers trace to the steps, the replay line (lib/ask/proof.ts) or the blocked count (lib/ask/blocked.json).
import type { AskEvent } from "./agent.ts";
import { displayName, forDisplay, nameForDisplay, type StepRecord } from "./check.ts";
import { callCard, cardsStep, decisionEvent, mapStep, stepsFrom, twinsStep, type MapStep } from "./steps.ts";
import { DOESNT_ESTABLISH } from "../vs.ts";

const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"];
export const TOOL_LABEL: Record<string, string> = { resolve: "Find the name", findRival: "Find the rival", split: "The split", candidates: "Eight candidates", review: "Score them", twins: "Overlap check" };

// the doubles result as one line, found or not (the page and the sheet share it)
export function doublesLine(steps: StepRecord[]): string | null {
  if (!steps.some((s) => s.tool === "twins" && s.output)) return null;
  const t = twinsStep(steps);
  return t
    ? `Overlap check: ${displayName(t.a)} and ${displayName(t.b)} sit closest to each other (${t.value.toFixed(2)}; the next pair ${t.next.toFixed(2)}), so calling both may reach one audience twice.`
    : "Overlap check: it ran, and no two contenders stand out as reaching the same audience.";
}

export type Sheet = {
  question: string;
  heading: string;
  card: { first: string; where: string | null };
  tiedNote: string | null;
  calls: { name: string; reason: string; steps: number[] }[];
  doubles: string;
  doublesStep: number;
  notes: { text: string; steps: number[] }[];
  map: MapStep | null;
  footnotes: { n: number; label: string; summary: string }[];
  limits: string[];
  proof: string;
  blocked: string;
  credit: string;
};

export function sheetModel(events: AskEvent[], o: { proof: string; blocked: number }): Sheet | null {
  const steps = stepsFrom(events);
  const d = decisionEvent(events);
  if (!d || d.type !== "decision" || !d.check.ok || !d.decision || !d.decision.calls.length) return null;
  const seed = (steps.find((s) => s.tool === "resolve")?.output as { name?: string } | undefined)?.name ?? "this name";
  const review = steps.find((s) => s.tool === "review");
  const tied = !!(review?.output as { noClearThree?: boolean } | undefined)?.noClearThree;
  const size = cardsStep(steps)?.cards.filter((c) => c.affinity !== null).length ?? 0;
  const twins = steps.find((s) => s.tool === "twins");
  return {
    question: `Who should ${displayName(seed)} call first?`,
    // the decision leads; the tie follows, smaller (Fable tie ruling, Oct 14)
    heading: `Call first: ${nameForDisplay(d.decision.calls[0].name)}`,
    card: callCard(steps, d.decision)!,
    tiedNote: tied ? `${review!.summary}. Inside a tie no order is claimed; the agent's ${WORDS[d.decision.calls.length] ?? d.decision.calls.length} from the group of ${WORDS[size] ?? size}.` : null,
    calls: d.decision.calls.map((c) => ({ name: nameForDisplay(c.name), reason: forDisplay(c.reason), steps: c.steps })),
    doubles: doublesLine(steps) ?? "Overlap check: not run.",
    doublesStep: twins?.n ?? 0,
    notes: [...d.decision.cautions, ...d.decision.summary].map((c) => ({ text: forDisplay(c.text), steps: c.steps })),
    map: mapStep(steps),
    footnotes: steps.map((s) => ({ n: s.n, label: TOOL_LABEL[s.tool] ?? s.tool, summary: s.summary })),
    limits: DOESNT_ESTABLISH,
    proof: o.proof,
    blocked: `Blocked by the checker under its current rule: ${o.blocked} answers, each listed on /audit with the rule that blocked it.`,
    credit: "Data: Qloo. Drawn by code. Every number cites a step.",
  };
}
