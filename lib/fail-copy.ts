// Calm copy for the two failures a judge could hit that aren't their fault. Client-safe: no server imports.
export type FailCode = "credit" | "cap" | "qloo";
export const FAIL_COPY: Record<FailCode, string> = {
  credit: "The brief writer is out of credit right now. The example brands still work.",
  cap: "Crossover has used today's taste-data allowance. The example brands still work.",
  // outage drill: a retry reuses every step Qloo already answered, so it doesn't spend twice
  qloo: "Qloo didn't answer one step. The steps on this page are what it measured; try again and it picks up from there.",
};
