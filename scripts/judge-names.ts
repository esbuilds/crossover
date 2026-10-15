// Six names a judge might type (Fable's judge-names brief, real Oct 15): each typed into the live site's /api/ask as a
// visitor's browser sends it, timed to the decision, Qloo calls counted from the shared daily counter before and after.
// Names and gate are written in research/report-oct15-judge-names.md before the run.
//   node --env-file=.env.local scripts/judge-names.ts [base url]
import { writeFileSync } from "node:fs";
import { qlooToday } from "../lib/qloo.ts";
import { stepsFrom } from "../lib/ask/steps.ts";
import type { AskEvent } from "../lib/ask/agent.ts";

const BASE = process.argv[2] ?? "https://crossover-henna.vercel.app";
const NAMES = ["Los Angeles Dodgers", "Noah Kahan", "Cedric the Entertainer", "PlayStation", "Calm", "Chipotle"];
const rows = [];
for (const q of NAMES) {
  const before = (await qlooToday()).today;
  const t0 = Date.now();
  let decidedAt: number | null = null;
  const events: AskEvent[] = [];
  let done: { cached?: boolean } | null = null;
  const res = await fetch(`${BASE}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
  const text = await res.text();
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const e = JSON.parse(line.slice(5));
    if (e.type === "decision") decidedAt = Date.now();
    if (e.type === "done") done = e;
    events.push(e);
  }
  // the whole body arrives at once with fetch().text(), so the decision time is the response time
  const secs = Math.round(((decidedAt ?? Date.now()) - t0) / 100) / 10;
  const after = (await qlooToday()).today;
  const steps = stepsFrom(events);
  const seed = steps.find((s) => s.tool === "resolve")?.output as { state?: string; name?: string; type?: string; options?: unknown[] } | undefined;
  const rival = steps.find((s) => s.tool === "findRival")?.output as { found?: boolean; rival?: { name: string }; by?: string } | undefined;
  const d = events.findLast((e) => e.type === "decision");
  const err = events.find((e) => e.type === "error") as { message?: string } | undefined;
  const row = {
    name: q,
    resolved: seed ? `${seed.state}${seed.name ? `: ${seed.name}` : ""}${seed.type ? ` (${seed.type.replace("urn:entity:", "")})` : ""}` : "no resolve step",
    rival: rival ? (rival.found ? `${rival.rival?.name} by ${rival.by}` : "none") : "not run",
    route: steps.map((s) => s.tool).join(" > "),
    secs,
    calls: before !== null && after !== null ? after - before : null,
    cached: !!done?.cached,
    check: d && d.type === "decision" ? (d.decision?.calls.length ? (d.check.ok ? "checked" : "blocked") : "no calls") : err ? `error: ${err.message}` : "no decision",
    calls3: d && d.type === "decision" ? (d.decision?.calls ?? []).map((c) => c.name.replace(/\[\[|\]\]/g, "")) : [],
    summary: d && d.type === "decision" ? [...(d.decision?.summary ?? []), ...(d.decision?.cautions ?? [])].map((c) => c.text).join(" | ").slice(0, 300) : "",
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync("audit/judge-names.json", JSON.stringify({ ranAt: new Date().toISOString(), base: BASE, rows }, null, 2));
