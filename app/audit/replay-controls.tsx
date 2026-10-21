import fair from "@/audit/popularity-fair.json";
import control from "@/audit/replay-control.json";
import { fairSentence } from "@/lib/popularity-fair.ts";
import { CONTROL_FREEZE, controlSentences } from "@/lib/replay-control.ts";

// Replay controls (moonshot round 2, real Oct 22), beside the v2 block: the scrambled-seed control
// (audit/replay-control-protocol.md) and the fair popularity number (scripts/popularity-fair.ts). Published as run.
export function ReplayControls() {
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-ink">Replay controls</h3>
      <p className="mt-1 max-w-copy text-base text-ink">{controlSentences(control).join(" ")}</p>
      <p className="mt-1 text-sm text-ink-3">Frozen at commit <code className="font-mono">{CONTROL_FREEZE}</code> (audit/replay-control-protocol.md, audit/replay-control.json).</p>
      <p className="mt-2 max-w-copy text-sm text-ink-2">{fairSentence(fair)}</p>
    </div>
  );
}
