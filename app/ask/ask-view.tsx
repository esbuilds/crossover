"use client";
// The /ask page: the agent's steps as they arrive, and its decision once the checker passes it.
import Link from "next/link";
import { useState } from "react";
import { btnPrimary, btnQuiet, field } from "../ui";
import { unbracket } from "@/lib/ask/check.ts";
import type { AskEvent } from "@/lib/ask/agent.ts";
import type { Decision } from "@/lib/ask/check.ts";

type Body = { query: string } | { id: string; type: string };
export const PREPARED_ASKS: { label: string; body: Body }[] = [
  { label: "Liquid Death", body: { id: "4DF7C265-52D9-4A99-8803-F62C2302D561", type: "urn:entity:brand" } },
  { label: "Olipop", body: { id: "6647FB92-9390-4B58-885B-86D96FF5BB6D", type: "urn:entity:brand" } },
  { label: "Mt. Joy", body: { id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: "urn:entity:artist" } },
];
type Step = { n: number; tool: string; why: string; summary?: string; output?: unknown };
const TOOL_LABEL: Record<string, string> = { resolve: "Find the name", findRival: "Find the rival", split: "The split", candidates: "Eight candidates", review: "Score them", twins: "Check for doubles" };

async function streamEvents(res: Response, onEvent: (e: AskEvent) => void) {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += value;
    const chunks = buf.split("\n\n");
    buf = chunks.pop()!;
    for (const c of chunks) if (c.startsWith("data: ")) onEvent(JSON.parse(c.slice(6)));
  }
}

export default function AskView() {
  const [q, setQ] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [decision, setDecision] = useState<{ decision: Decision | null; ok: boolean; problems: string[] } | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function run(body: Body) {
    setSteps([]); setDecision(null); setError(""); setStatus("running");
    const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setStatus("error"); setError("Type a name to ask about."); return; }
    await streamEvents(res, (e) => {
      if (e.type === "call") setSteps((s) => [...s, { n: e.n, tool: e.tool, why: e.why }]);
      if (e.type === "result") setSteps((s) => s.map((x) => (x.n === e.n ? { ...x, summary: e.summary, output: e.output } : x)));
      if (e.type === "decision") setDecision({ decision: e.decision, ok: e.check.ok, problems: e.check.ok ? [] : e.check.problems });
      if (e.type === "done") setStatus("done");
      if (e.type === "error") { setStatus("error"); setError(e.message); }
    });
  }
  const ambiguous = steps.find((s) => s.tool === "resolve" && (s.output as { state?: string })?.state === "ambiguous")?.output as { options: { name: string; id: string; type: string }[] } | undefined;

  return (
    <>
      <section className="pt-8">
        <h1 className="font-display text-2xl sm:text-3xl">Who should they call first?</h1>
        <p className="mt-2 max-w-[68ch] text-lg text-ink-2">One name in. The agent decides what to measure next and why; every number comes from Qloo, and every line of its answer is checked against the step behind it.</p>
        <form onSubmit={(ev) => (ev.preventDefault(), q.trim() && run({ query: q.trim() }))} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input value={q} onChange={(ev) => setQ(ev.target.value)} aria-label="A brand, artist, show or person" placeholder="A brand, artist, show or person" className={`${field} sm:max-w-md`} />
          <button type="submit" disabled={status === "running"} className={btnPrimary}>Ask</button>
        </form>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 text-base">
          <span className="text-ink-2">Try:</span>
          {PREPARED_ASKS.map((p) => <button key={p.label} type="button" onClick={() => (setQ(p.label), run(p.body))} className={btnQuiet}>{p.label}</button>)}
        </p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section className="order-2 lg:order-1">
          {steps.length > 0 && <h2 className="font-display text-xl">Steps</h2>}
          <ol className="mt-3 space-y-4">
            {steps.map((s) => (
              <li key={s.n} id={`step-${s.n}`} className="scroll-mt-4 border-t border-rule pt-3">
                <p className="font-mono text-sm text-ink-3">{s.n}. {TOOL_LABEL[s.tool] ?? s.tool}</p>
                <p className="mt-1 text-base text-ink-2">{s.why}</p>
                <p className="mt-1 text-base text-ink">{s.summary ?? <span className="font-mono text-sm motion-safe:animate-pulse">Reading Qloo...</span>}</p>
              </li>
            ))}
          </ol>
          {ambiguous && (
            <div className="mt-4">
              <p className="text-base text-ink">Which one did you mean?</p>
              <p className="mt-2 flex flex-wrap gap-x-4">{ambiguous.options.map((o) => <button key={o.id} type="button" onClick={() => run({ id: o.id, type: o.type })} className={btnQuiet}>{o.name} ({o.type.replace("urn:entity:", "").replace("_", " ")})</button>)}</p>
            </div>
          )}
        </section>

        <section className="order-1 lg:order-2">
          {decision?.ok && decision.decision && (
            <>
              {decision.decision.calls.length > 0 && <h2 className="font-display text-xl">The call</h2>}
              <ol className="mt-3 space-y-3">
                {decision.decision.calls.map((c, i) => (
                  <li key={c.name + i} className="border-t border-rule pt-3">
                    <p className="text-lg text-ink">{i + 1}. {unbracket(c.name)}</p>
                    <p className="mt-1 text-base text-ink-2">{unbracket(c.reason)} <Steps ns={c.steps} /></p>
                  </li>
                ))}
              </ol>
              {[...decision.decision.cautions, ...decision.decision.summary].map((c) => (
                <p key={c.text} className="mt-3 max-w-[60ch] text-base text-ink-2">{unbracket(c.text)} <Steps ns={c.steps} /></p>
              ))}
              <p className="mt-6"><Link href="/audit" className={btnQuiet}>Next: is any of this right? The audit</Link></p>
            </>
          )}
          {decision && !decision.ok && status !== "running" && (
            <p className="text-base text-ink-2">{decision.decision ? "The agent's summary didn't match its own steps, so it isn't shown. The steps are what it measured." : decision.problems[0]}</p>
          )}
          {error && <p className="text-lg text-ink">{error}</p>}
        </section>
      </div>
    </>
  );
}

function Steps({ ns }: { ns: number[] }) {
  return <span className="font-mono text-sm text-ink-3">{ns.map((n) => <a key={n} href={`#step-${n}`} className="ml-1 underline decoration-rule-strong underline-offset-4">step {n}</a>)}</span>;
}
