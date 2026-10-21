import forks from "@/audit/forks.json";
import look from "@/audit/second-look.json";
import { forksSentences } from "@/lib/forks.ts";

// What the agent decided, counted (AGENT-6, real Oct 22): scripts/forks.ts over every cached ask, then the second look's
// Gate C (audit/second-look-protocol.md). Published as run.
export function AgentForks() {
  return (
    <section id="agent-decided" className="mt-section max-w-copy scroll-mt-4">
      <h2 className="font-display text-xl">What the agent decided, counted</h2>
      {forksSentences(forks.counts, look.gateC.summary).map((t) => <p key={t} className="mt-3 text-base text-ink-2">{t}</p>)}
      <p className="mt-1 text-sm text-ink-3">audit/forks.json (Redis only, 0 calls); audit/second-look.json, run {look.gateC.ranAt} under audit/second-look-protocol.md. The second look isn&apos;t on the answer pages; the answer of record doesn&apos;t change.</p>
    </section>
  );
}
