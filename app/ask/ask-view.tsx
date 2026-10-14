"use client";
// The ask (the front door since Pick A, Oct 13): the agent's steps as they arrive, three of them drawn as pictures by
// existing pieces (the split's map, the eight cards, the twins pair), and the decision once the checker passes it.
// initial: a cached ask the server replayed (no POST, no Qloo call); pending: a share link whose ask isn't cached yet.
import Link from "next/link";
import { useEffect, useState } from "react";
import { btnPrimary, btnQuiet, field, JudgePath } from "../ui";
import CollisionMap from "../vs/collision-map";
import { displayName, forDisplay, type Decision, type StepRecord } from "@/lib/ask/check.ts";
import { cardsStep, mapStep, stepsFrom, twinsStep, type CardsStep, type MapStep, type TwinsStep } from "@/lib/ask/steps.ts";
import { shareQuery } from "@/lib/review-share.ts";
import { PREPARED_ASKS } from "@/lib/ask/prepared.ts";
import type { AskEvent } from "@/lib/ask/agent.ts";
import type { VsPayload } from "@/lib/rivals.ts";

type Body = { query: string } | { id: string; type: string };
const TOOL_LABEL: Record<string, string> = { resolve: "Find the name", findRival: "Find the rival", split: "The split", candidates: "Eight candidates", review: "Score them", twins: "Check for doubles" };
type Verdict = { decision: Decision | null; ok: boolean; problems: string[] };

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

const verdictOf = (events: AskEvent[]): Verdict | null => {
  const d = events.findLast((e) => e.type === "decision");
  return d && d.type === "decision" ? { decision: d.decision, ok: d.check.ok, problems: d.check.ok ? [] : d.check.problems } : null;
};

// proof: the replay line (lib/ask/steps.ts replayLine), passed from the server so the replay files stay off the client
export default function AskView({ initial, pending, proof }: { initial?: { label: string; events: AskEvent[] }; pending?: { label: string; body: Body }; proof?: string }) {
  const [q, setQ] = useState(initial?.label ?? pending?.label ?? "");
  const [events, setEvents] = useState<AskEvent[]>(initial?.events ?? []);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(initial ? "done" : "idle");
  const [error, setError] = useState("");
  const steps = stepsFrom(events);
  const verdict = verdictOf(events);

  async function run(body: Body) {
    setEvents([]); setError(""); setStatus("running");
    // a dropped connection must not leave the button disabled (deferred minor, fixed Oct 13)
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { setStatus("error"); setError("Type a name to ask about."); return; }
      await streamEvents(res, (e) => {
        if (e.type === "call" || e.type === "result" || e.type === "decision") setEvents((x) => [...x, e]);
        if (e.type === "done") setStatus("done");
        if (e.type === "error") { setStatus("error"); setError(e.message); }
      });
    } catch {
      setStatus("error");
      setError("The connection dropped. The steps above are what the agent measured; try again to finish.");
    }
  }
  const resolved = steps.find((s) => s.tool === "resolve")?.output as { state?: string; name?: string; id?: string; type?: string; options?: { name: string; id: string; type: string }[] } | undefined;
  const ambiguous = resolved?.state === "ambiguous" ? resolved.options : undefined;
  const chips = [...PREPARED_ASKS, ...(pending && "id" in pending.body ? [{ label: pending.label, body: pending.body }] : [])];

  return (
    <>
      <section className="pt-8">
        <h1 className="font-display text-2xl sm:text-3xl">One name in. Who should they call first?</h1>
        <p className="mt-2 max-w-[68ch] text-lg text-ink-2">The agent decides what to measure next and why; every number comes from Qloo, and every line of its answer is checked against the step behind it.</p>
        <JudgePath />
        <form onSubmit={(ev) => (ev.preventDefault(), q.trim() && run({ query: q.trim() }))} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input value={q} onChange={(ev) => setQ(ev.target.value)} aria-label="A brand, artist, show or person" placeholder="A brand, artist, show or person" className={`${field} sm:max-w-md`} />
          <button type="submit" disabled={status === "running"} className={btnPrimary}>Ask</button>
        </form>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 text-base">
          <span className="text-ink-2">Try:</span>
          {chips.map((p) => (
            <button key={p.label} type="button" disabled={status === "running"} onClick={() => (setQ(p.label), run(p.body))} className={btnQuiet}>{p.label}</button>
          ))}
        </p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section id="steps" className="order-2 scroll-mt-4 lg:order-1">
          {steps.length > 0 && <h2 className="font-display text-xl">Steps</h2>}
          <ol className="mt-3 space-y-4">
            {steps.map((s) => (
              <li key={s.n} id={`step-${s.n}`} className="scroll-mt-4 border-t border-rule pt-3">
                <p className="font-mono text-sm text-ink-3">{s.n}. {TOOL_LABEL[s.tool] ?? s.tool}</p>
                <p className="mt-1 text-base text-ink-2">{s.why}</p>
                <p className="mt-1 text-base text-ink">{s.summary || <span className="font-mono text-sm motion-safe:animate-pulse">Reading Qloo...</span>}</p>
                <Picture step={s} steps={steps} />
              </li>
            ))}
          </ol>
          {ambiguous && (
            <div className="mt-4">
              <p className="text-base text-ink">Which one did you mean?</p>
              <p className="mt-2 flex flex-wrap gap-x-4">{ambiguous.map((o) => <button key={o.id} type="button" onClick={() => run({ id: o.id, type: o.type })} className={btnQuiet}>{o.name} ({o.type.replace("urn:entity:", "").replace("_", " ")})</button>)}</p>
            </div>
          )}
        </section>

        <section className="order-1 lg:order-2">
          {verdict?.ok && verdict.decision && (
            <>
              {verdict.decision.calls.length > 0 && <h2 className="font-display text-xl">The call</h2>}
              <ol className="mt-3 space-y-3">
                {verdict.decision.calls.map((c, i) => (
                  <li key={c.name + i} className="border-t border-rule pt-3">
                    <p className="text-lg text-ink">{i + 1}. {forDisplay(c.name)}</p>
                    <p className="mt-1 text-base text-ink-2">{forDisplay(c.reason)} <Steps ns={c.steps} /></p>
                  </li>
                ))}
              </ol>
              {[...verdict.decision.cautions, ...verdict.decision.summary].map((c) => (
                <p key={c.text} className="mt-3 max-w-[60ch] text-base text-ink-2">{forDisplay(c.text)} <Steps ns={c.steps} /></p>
              ))}
              {/* counted from the steps, not from Qloo's meter: a cached replay makes no calls at all */}
              <p className="mt-4 font-mono text-sm text-ink-3">{steps.length} steps, each measured in Qloo; every number above comes from a step.</p>
              {proof && <p className="mt-2 max-w-[60ch] text-sm text-ink-2">{proof}</p>}
              <p className="mt-4 flex flex-wrap gap-x-4">
                {resolved?.id && resolved.type && <CopyAsk id={resolved.id} type={resolved.type} />}
                <Link href="/audit" className={btnQuiet}>Next: is any of this right? The audit</Link>
              </p>
            </>
          )}
          {verdict && !verdict.ok && status !== "running" && (
            <p className="text-base text-ink-2">{verdict.decision ? "The agent's summary didn't match its own steps, so it isn't shown. The steps are what it measured." : verdict.problems[0]}</p>
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

function CopyAsk({ id, type }: { id: string; type: string }) {
  const [copied, setCopied] = useState(false);
  const link = () => `${window.location.origin}/ask/${id}?t=${encodeURIComponent(type)}`;
  return (
    <button type="button" className={btnQuiet} onClick={() => navigator.clipboard.writeText(link()).then(() => setCopied(true), () => {})}>
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}

// Steps 3, 5 and 6 drawn (Pick A): only from the step outputs, so a picture never shows a number the checker can't see.
function Picture({ step, steps }: { step: StepRecord; steps: StepRecord[] }) {
  if (!step.output) return null;
  if (step.tool === "split") { const m = mapStep(steps); return m ? <MapPicture m={m} /> : null; }
  if (step.tool === "review") { const c = cardsStep(steps); return c ? <CardsPicture c={c} steps={steps} /> : null; }
  if (step.tool === "twins") { const t = twinsStep(steps); return t ? <TwinsPicture t={t} /> : null; }
  return null;
}

function MapPicture({ m }: { m: MapStep }) {
  const [map, setMap] = useState<VsPayload["map"] | null>(null);
  const q = new URLSearchParams({ a: m.seed.id!, ta: m.seed.type!, b: m.rival.id!, tb: m.rival.type! }).toString();
  useEffect(() => {
    // the split already ran this pair, so this is a cache read on the /vs route's own keys
    fetch(`/api/rivals?${q}`).then((r) => (r.ok ? r.json() : null)).then((d: VsPayload | null) => setMap(d?.map ?? null), () => {});
  }, [q]);
  return (
    <div className="mt-3">
      {map && <div className="max-w-md"><CollisionMap cells={map.cells} metrosA={map.metrosA} metrosB={map.metrosB} a={m.seed.name} b={m.rival.name} /></div>}
      <p className="mt-2 text-sm text-ink-2 tabular-nums">{m.closerToSeed} closer to {m.seed.name} · {m.closerToRival} closer to {m.rival.name} · {m.withinGapOfBoth} within 0.05 of both</p>
      <p className="mt-1 text-sm text-ink-2">Top markets. {m.seed.name}: {m.seedMarkets.join(", ")}. {m.rival.name}: {m.rivalMarkets.join(", ")}.</p>
      <p className="mt-1"><Link href={m.href} className={btnQuiet}>Open the full split</Link></p>
    </div>
  );
}

const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"];
function CardsPicture({ c, steps }: { c: CardsStep; steps: StepRecord[] }) {
  const seed = steps.find((s) => s.tool === "resolve")?.output as { name: string; id: string; type: string } | undefined;
  const cands = (steps.find((s) => s.tool === "candidates")?.output as { candidates?: { name: string; id: string }[] } | undefined)?.candidates ?? [];
  // the same eight in the candidates step's order, so Pick three reads the scores this ask already cached
  const pick = seed && cands.length ? `/pick-three?${shareQuery({ caseKey: null, seed: { name: seed.name, id: seed.id, type: seed.type }, names: cands.map((x) => ({ name: x.name, id: x.id, type: "urn:entity:brand" })), picks: [], gate: false })}` : null;
  return (
    <div className="mt-3">
      {c.fameFlat && <p className="font-display text-lg text-ink">Fame can&apos;t tell these {WORDS[c.cards.length] ?? c.cards.length} apart. Taste can.</p>}
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {c.cards.map((x) => (
          <li key={x.name} className="min-w-0 rounded-sm border border-rule px-2 py-2">
            <p className="truncate text-sm text-ink" title={displayName(x.name)}>{displayName(x.name)}</p>
            <p className="text-sm text-ink-2 tabular-nums">{x.affinity === null ? "no measurement" : x.affinity.toFixed(2)}</p>
            <p className="text-xs text-ink-3">{x.fameBand === 0 ? "Best known" : "Less known"}</p>
          </li>
        ))}
      </ul>
      {pick && <p className="mt-2"><Link href={pick} className={btnQuiet}>Pick your own three from these eight</Link></p>}
    </div>
  );
}

function TwinsPicture({ t }: { t: TwinsStep }) {
  return (
    <p className="mt-3 max-w-[60ch] text-sm text-ink-2 tabular-nums">
      {displayName(t.a)} and {displayName(t.b)} sit closest to each other: their fans lean toward each other at {t.value.toFixed(2)}; the next closest pair here is {t.next.toFixed(2)}. Calling both may reach one audience twice.
    </p>
  );
}
