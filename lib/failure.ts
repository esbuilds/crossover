import { QuotaError } from "./qloo.ts";
import { ColdPairCap } from "./rivals.ts";
import { CapReached } from "./agent/stream-cache.ts";
import { FAIL_COPY, type FailCode } from "./fail-copy.ts";

// Which calm failure this is, if any: the Anthropic balance ran out (Oct 23 warm pass), or Crossover's own daily
// Qloo cap was reached, or Qloo itself answered with a 5xx after its one retry. Everything else keeps its specific message.
export function failCode(err: unknown): FailCode | null {
  if (err instanceof QuotaError && /daily cap/.test(err.message)) return "cap";
  const e = err as { message?: string; responseBody?: string; cause?: { message?: string } } | null;
  const text = [e?.message, e?.responseBody, e?.cause?.message].filter(Boolean).join(" ");
  if (/credit balance is too low/i.test(text)) return "credit";
  return /^Qloo 5\d\d /.test(e?.message ?? "") ? "qloo" : null;
}

// The ask route's error line. ColdPairCap is the per-visitor daily cap on new pairs (lib/rivals.ts), not Qloo being busy:
// it read "try this one again in a minute" until Oct 27, which fails again a minute later.
export function askErrorCopy(err: unknown): string {
  const code = failCode(err);
  if (code) return FAIL_COPY[code];
  if (err instanceof CapReached) return "You've hit today's limit of 20 new asks. Asks you've already opened still work, and the limit resets tomorrow.";
  if (err instanceof ColdPairCap) return "That's the ten new names and pairs Crossover runs for one visitor in a day. Names already asked still work, and the count resets at midnight UTC.";
  if (err instanceof QuotaError) return "Qloo's taste data is busy right now. Prepared asks still work; try this one again in a minute.";
  return "The agent stopped partway. The steps below are what it measured; try again to finish.";
}
