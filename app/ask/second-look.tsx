"use client";
// The second look (AGENT-1, moonshot round 2, real Oct 22): a block beside the frozen answer, never instead of it. On a
// click it asks /api/ask/second (cached looks replay at once; a new one runs the model and up to 16 Qloo calls), then
// shows the new steps, any checker "no" fed back to the agent, and its answer with the same step links. Not mounted:
// builder 1 owns ask-view.tsx. Mount point: under the "Checker rule" line in AskView's decision section.
import { useState } from "react";
import { btnText, linkInline, panel } from "../ui";
import { forDisplay, nameForDisplay, type Check, type Decision } from "@/lib/ask/check.ts";
import type { LookEvent } from "@/lib/ask/second.ts";

type Body = { query: string } | { id: string; type: string } | { case: string };
type Row = { name: string; seedRankAmongTheirFans: number | string };
type Step = { n: number; why: string; summary: string; rows: Row[] };
type Look = Extract<LookEvent, { type: "look" }>;

const list = (names: string[]) => names.map(nameForDisplay).join(", ");
// what happened, by code from the look event; the agent's own words are only in its cited reasons below
export function lookLine(l: Look) {
  if (l.outcome === "blocked") return "The second look's answer didn't pass the checker, so it isn't shown. The answer above stands.";
  const how = l.measured ? "It measured the other direction" : "It kept to the steps above without measuring more";
  if (l.outcome === "declined") return `${how}, then declined to call anyone. The answer above called ${list(l.frozen)}.`;
  if (l.outcome === "kept") return `${how}, then kept the calls: ${list(l.calls)}.`;
  return `${how}, then changed the calls to ${list(l.calls)}. The answer above called ${list(l.frozen)}.`;
}

export default function SecondLook({ body }: { body: Body }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [checks, setChecks] = useState<string[][]>([]);
  const [final, setFinal] = useState<{ decision: Decision | null; check: Check } | null>(null);
  const [look, setLook] = useState<Look | null>(null);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const run = async () => {
    setState("running");
    try {
      const res = await fetch("/api/ask/second", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "The second look isn't available for this ask.");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const e = JSON.parse(p.replace(/^data: /, "")) as LookEvent | { type: "done" } | { type: "error"; message: string };
          if (e.type === "call") setSteps((s) => [...s, { n: e.n, why: e.why, summary: "", rows: [] }]);
          if (e.type === "result") setSteps((s) => s.map((x) => (x.n === e.n ? { ...x, summary: e.summary, rows: (e.output as { rows?: Row[] })?.rows ?? [] } : x)));
          if (e.type === "check") setChecks((c) => [...c, e.problems]);
          if (e.type === "decision") setFinal({ decision: e.decision, check: e.check });
          if (e.type === "look") setLook(e);
          if (e.type === "error") throw new Error(e.message);
        }
      }
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  };

  return (
    <section className="mt-8 border-t border-rule pt-6" aria-live="polite">
      <h3 className="text-lg font-semibold">Second look</h3>
      <p className="mt-2 max-w-copy text-sm text-ink-3">The agent re-reads its own steps and may measure the other direction: where each candidate&apos;s fans rank this name. The answer above is the answer of record and doesn&apos;t change.</p>
      {state === "idle" && <p className="mt-3"><button type="button" onClick={run} className={btnText}>Take a second look</button></p>}
      {state === "running" && !steps.length && <p className="working mt-3 font-mono text-sm text-ink-2" role="status">Reading the steps above...</p>}
      <ol className="mt-4 space-y-6">
        {steps.map((s) => (
          <li key={s.n} id={`step-${s.n}`} className="scroll-mt-4 border-t border-rule pt-4">
            <p className="font-mono text-sm text-ink-3">{s.n}. The other direction</p>
            <p className="mt-1 text-base text-ink-2">{s.why}</p>
            <p className="mt-1 text-base text-ink">{s.summary || <span className="working font-mono text-sm">Reading Qloo...</span>}</p>
            {s.rows.length > 0 && (
              <table className="mt-3 w-full max-w-md text-sm tabular-nums">
                <thead><tr className="text-left text-ink-3"><th className="font-normal">Their fans</th><th className="text-right font-normal">Rank this name</th></tr></thead>
                <tbody>{s.rows.map((r) => <tr key={r.name} className="border-t border-rule text-ink"><td className="py-1">{nameForDisplay(r.name)}</td><td className="text-right">{typeof r.seedRankAmongTheirFans === "number" ? r.seedRankAmongTheirFans : "not in top 50"}</td></tr>)}</tbody>
              </table>
            )}
          </li>
        ))}
      </ol>
      {checks.map((p, i) => (
        <div key={i} className={`${panel} mt-4 p-4`} role="status">
          <p className="font-mono text-sm text-ink-3">Check</p>
          <p className="mt-1 text-base text-ink">The checker rejected the second look&apos;s first answer and sent it back once:</p>
          <ul className="mt-1 list-disc pl-5 font-mono text-sm text-ink-2">{p.map((x) => <li key={x}>{forDisplay(x)}</li>)}</ul>
        </div>
      ))}
      {look && <p className="mt-4 max-w-copy text-base text-ink">{lookLine(look)}</p>}
      {final?.check.ok && final.decision && (
        <ul className="mt-3 space-y-3">
          {[...final.decision.calls.map((c) => ({ text: c.reason, steps: c.steps })), ...final.decision.cautions, ...final.decision.summary].map((c) => (
            <li key={c.text} className="claim max-w-copy text-base text-ink-2">{forDisplay(c.text)} <span className="font-mono text-sm text-ink-3">{c.steps.map((n) => <a key={n} href={`#step-${n}`} className={`ml-1 whitespace-nowrap ${linkInline}`}>step {n}</a>)}</span></li>
          ))}
        </ul>
      )}
      {final?.check.ok && <p className="mt-3 text-sm text-ink">Checked: every name and number in the second look traces to the step it cites.</p>}
      {state === "error" && <p className="mt-3 text-base text-ink-2" role="alert">{error}</p>}
    </section>
  );
}
