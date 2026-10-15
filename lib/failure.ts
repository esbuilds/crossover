import { QuotaError } from "./qloo.ts";
import type { FailCode } from "./fail-copy.ts";

// Which calm failure this is, if any: the Anthropic balance ran out (Oct 23 warm pass), or Crossover's own daily
// Qloo cap was reached, or Qloo itself answered with a 5xx after its one retry. Everything else keeps its specific message.
export function failCode(err: unknown): FailCode | null {
  if (err instanceof QuotaError && /daily cap/.test(err.message)) return "cap";
  const e = err as { message?: string; responseBody?: string; cause?: { message?: string } } | null;
  const text = [e?.message, e?.responseBody, e?.cause?.message].filter(Boolean).join(" ");
  if (/credit balance is too low/i.test(text)) return "credit";
  return /^Qloo 5\d\d /.test(e?.message ?? "") ? "qloo" : null;
}
