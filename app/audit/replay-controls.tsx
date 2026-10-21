import fair from "@/audit/popularity-fair.json";
import { fairSentence } from "@/lib/popularity-fair.ts";

// Replay controls (moonshot round 2, real Oct 22), beside the v2 block: the fair popularity number (scripts/popularity-fair.ts).
export function ReplayControls() {
  return (
    <div className="mt-4">
      <p className="max-w-copy text-sm text-ink-2">{fairSentence(fair)}</p>
    </div>
  );
}
