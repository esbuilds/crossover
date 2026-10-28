// "What the agent decided, counted": the /audit row, every number read from audit/forks.json (scripts/forks.ts,
// Redis only) and Gate C's summary in audit/second-look.json (scripts/second-look.ts gate-c).
type Counts = { asks: number; withRefusal: number; widened: number; decided: number; noClearThree: number; calledThroughTie: number; stoppedAtName: number };
export type GateC = { seeds: number; checked: number; need: number; kept: number; changed: number; declined: number; blocked: number; measured: number; checkFed: number; citedLess: number; pass: boolean };

export function forksSentences(c: Counts, g: GateC | null) {
  const out = [
    `Across ${c.asks} cached asks the tools refused a call ${c.withRefusal} times, the candidate list widened ${c.widened} times, and ${c.stoppedAtName} stopped at the name. In ${c.noClearThree} of the ${c.decided} that reached a decision, the first measurement tied (no clear three), and the agent named its calls anyway in ${c.calledThroughTie} of them.`,
  ];
  if (g) out.push(
    `The second look, run on the ${g.seeds} names with a current answer, reads that tie and may measure the other direction: it did in ${g.measured}, then kept the calls in ${g.kept}, changed them in ${g.changed} and declined in ${g.declined}; ${g.blocked} failed the checker. The checker sent ${g.checkFed} answers back once, and ${g.citedLess} passed the second time only by citing less. ${g.pass ? "It passes its bar" : "It fails its bar"}: ${g.checked} of ${g.seeds} checked, needed ${g.need}.`,
  );
  return out;
}
