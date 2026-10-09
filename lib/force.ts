// Development only: force failure paths to test error states. CROSSOVER_FORCE=qloo429,anthropic,novenues,noheatmap
// in .env.local. Ignored outside development.
export const forced = (what: "qloo429" | "anthropic" | "novenues" | "noheatmap") =>
  process.env.NODE_ENV === "development" && (process.env.CROSSOVER_FORCE ?? "").split(",").includes(what);
