import fair from "@/audit/popularity-fair.json";
import control from "@/audit/replay-control.json";
import { fairSentence } from "@/lib/popularity-fair.ts";
import { CONTROL_FREEZE, controlSentences } from "@/lib/replay-control.ts";
import reverse from "@/audit/replay-reverse.json";
import { REVERSE_FREEZE, reverseLimit, reverseSentences } from "@/lib/replay-reverse.ts";

// Replay controls, beside the v2 block: the scrambled-seed control
// (audit/replay-control-protocol.md), the fair popularity number (scripts/popularity-fair.ts) and the reverse replay
// (audit/replay-reverse-protocol.md). Published as run.
export function ReplayControls() {
  return (
    <div id="replay-controls" className="mt-6 scroll-mt-4">
      <h3 className="text-base font-semibold text-ink">Replay controls</h3>
      <p className="mt-1 max-w-copy text-base text-ink">{controlSentences(control).join(" ")}</p>
      <p className="mt-1 text-sm text-ink-3">Frozen at commit <code className="font-mono">{CONTROL_FREEZE}</code> (audit/replay-control-protocol.md, audit/replay-control.json).</p>
      <p className="mt-2 max-w-copy text-sm text-ink-2">{fairSentence(fair)}</p>
      <p id="reverse-replay" className="mt-4 max-w-copy scroll-mt-4 text-base text-ink">{reverseSentences(reverse).join(" ")}</p>
      <p className="mt-1 max-w-copy text-base text-ink-2">{reverseLimit(reverse)}</p>
      <p className="mt-1 text-sm text-ink-3">Frozen at commit <code className="font-mono">{REVERSE_FREEZE}</code> (audit/replay-reverse-protocol.md, audit/replay-reverse.json).</p>
    </div>
  );
}
