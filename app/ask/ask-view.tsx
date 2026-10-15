"use client";
// The ask (the front door since Pick A, Oct 13): the agent's steps as they arrive, a picture of the split (or, without a
// split, the fame-to-taste dumbbell) above the fold, and the decision once the checker passes it (Pick 1, Oct 14).
// initial: a cached ask the server replayed (no POST, no Qloo call); pending: a share link whose ask isn't cached yet.
import Link from "next/link";
import { useEffect, useState } from "react";
import { btnPrimary, btnQuiet, field, JudgePath } from "../ui";
import CollisionMap from "../vs/collision-map";
import { displayName, forDisplay, nameForDisplay, type Decision, type StepRecord } from "@/lib/ask/check.ts";
import { askLinks } from "@/lib/ask/links.ts";
import { callCard, cardsStep, decisionEvent, forkLine, dumbbellStep, mapStep, stepsFrom, twinsStep, type DumbbellRow, type MapStep } from "@/lib/ask/steps.ts";
import { mapLine } from "@/lib/vs.ts";
import { shareQuery } from "@/lib/review-share.ts";
import { PREPARED_ASKS } from "@/lib/ask/prepared.ts";
import { tourHref } from "@/lib/tour.ts";
import type { AskEvent } from "@/lib/ask/agent.ts";
import type { VsPayload } from "@/lib/rivals.ts";
import type { BothWays } from "@/lib/ask/both-ways.ts";
import { BothTable } from "./both-table";

type Body = { query: string } | { id: string; type: string } | { case: string };
const TOOL_LABEL: Record<string, string> = { resolve: "Find the name", findRival: "Find the rival", split: "The split", candidates: "Eight candidates", review: "Score them", twins: "Check for doubles" };
type Verdict = { decision: Decision | null; ok: boolean; problems: string[] };
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"];
// Measured on cold asks real Oct 13 to 14 (Allbirds, Yeti, Dove, Cedric the Entertainer, Dr. Squatch): 5 to 6 steps,
// 9 to 22 Qloo calls, 25 to 47 seconds, plus up to 8 for the both-ways table (one per candidate, reverse-probe Oct 15).
// Rounded; update if the tools change.
const COST = "About 6 steps, about 28 Qloo calls and 40 seconds on a name nobody has asked about yet; a name already asked replays at once.";
// the same limits line Pick three's evidence shows (lib/vs.ts DOESNT_ESTABLISH, condensed)
const LIMITS = "What this doesn't establish: purchases, visits, commercial eligibility, or whether the deal makes money.";

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
  const d = decisionEvent(events);
  return d && d.type === "decision" ? { decision: d.decision, ok: d.check.ok, problems: d.check.ok ? [] : d.check.problems } : null;
};

// proof: the replay line (lib/ask/steps.ts replayLine), passed from the server so the replay files stay off the client
// initial.asked: the body the cached ask was run with, so its share and sheet links find it (typed names are keyed by the name)
export default function AskView({ initial, pending, proof }: { initial?: { label: string; events: AskEvent[]; asked?: Body }; pending?: { label: string; body: Body }; proof?: string }) {
  const [q, setQ] = useState(initial?.label ?? pending?.label ?? "");
  const [events, setEvents] = useState<AskEvent[]>(initial?.events ?? []);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(initial ? "done" : "idle");
  const [error, setError] = useState("");
  const [asked, setAsked] = useState<Body | null>(initial?.asked ?? null);
  const steps = stepsFrom(events);
  const verdict = verdictOf(events);
  const map = mapStep(steps);
  const bell = dumbbellStep(steps);
  const hero: "map" | "dumbbell" | null = map ? "map" : bell ? "dumbbell" : null;
  const card = verdict?.ok && verdict.decision ? callCard(steps, verdict.decision) : null;

  async function run(body: Body) {
    setEvents([]); setError(""); setStatus("running"); setAsked(body);
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
  const chips: { label: string; body: Body }[] = [...PREPARED_ASKS, ...(pending && !("query" in pending.body) ? [{ label: pending.label, body: pending.body }] : [])];

  return (
    <>
      <section className="pt-6">
        <h1 className="font-display text-2xl sm:text-3xl">One name in. Who should they call first?</h1>
        <p className="mt-2 max-w-[68ch] text-lg text-ink-2">
          {/* phones get the short line, so the card and the map's top edge fit the first 390x800 screen (Fable tie ruling) */}
          <span className="sm:hidden">Every number comes from Qloo; every name and number in the answer is checked.</span>
          <span className="max-sm:hidden">The agent decides what to measure next and why; every number comes from Qloo, and every name and number in its answer is checked against the step it cites.</span>
        </p>
        <JudgePath />
        <p className="mt-1 text-sm"><Link href={tourHref(1)} className="underline decoration-rule-strong underline-offset-4 hover:text-ink">Take the 60-second tour</Link></p>
        <p className="mt-3 max-w-[80ch] text-sm text-ink-3 max-sm:hidden">{COST}</p>
        <p className="mt-1 max-w-[80ch] text-sm text-ink-3 max-sm:hidden">{LIMITS}</p>
        <p className="mt-2 text-xs text-ink-3 sm:hidden">About 40 seconds and 28 Qloo calls for a new name. Not purchases, visits, eligibility or deal value.</p>
        <form onSubmit={(ev) => (ev.preventDefault(), q.trim() && run({ query: q.trim() }))} className="mt-3 flex flex-row gap-3">
          <input value={q} onChange={(ev) => setQ(ev.target.value)} aria-label="A brand, artist, show or person" placeholder="A brand, artist, show or person" className={`${field} min-w-0 flex-1 sm:max-w-md`} />
          <button type="submit" disabled={status === "running"} className={btnPrimary}>Ask</button>
        </form>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 text-base">
          <span className="text-ink-2">Try:</span>
          {chips.map((p) => (
            <button key={p.label} type="button" disabled={status === "running"} onClick={() => (setQ(p.label), run(p.body))} className={btnQuiet}>{p.label}</button>
          ))}
        </p>
      </section>

      {/* phones: the call card, the picture, the decision, the steps (Fable tie ruling, Oct 14). From 1024: the card and
          the decision down the right, the picture and then the steps down the left. */}
      <div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2 lg:items-start">
        {card && (
          <section className="order-1 lg:col-start-2 lg:row-start-1">
            <div className="rounded-sm border border-rule-strong px-4 py-3">
              <p className="text-xl text-ink">{card.first}</p>
              {card.where && <p className="mt-1 text-base text-ink-2">{card.where}</p>}
              {resolved?.id && resolved.type && <WhereLine id={resolved.id} type={resolved.type} asked={asked} />}
            </div>
          </section>
        )}

        {(hero || status === "running") && (
          <section id="hero" className="order-2 scroll-mt-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            {hero === "map" ? <MapPicture m={map!} n={steps.find((s) => s.tool === "split")!.n} /> : hero === "dumbbell" ? <Dumbbell rows={bell!.rows} steps={steps} /> : (
              // persona test, Oct 14: the slot is held while the steps run, so nothing jumps columns when the picture lands
              <p className="min-h-48 text-sm text-ink-3">The picture appears here when the split or the scores arrive.</p>
            )}
          </section>
        )}

        <section className="order-3 lg:col-start-2 lg:row-span-2 lg:row-start-2">
          {verdict?.ok && verdict.decision && <Call decision={verdict.decision} steps={steps} under={resolved?.id && resolved.type ? <BothBlock id={resolved.id} type={resolved.type} asked={asked} /> : null} />}
          {verdict?.ok && verdict.decision && (
            <>
              {/* counted from the steps, not from Qloo's meter: a cached replay makes no calls at all */}
              <p className="mt-4 font-mono text-sm text-ink-3">{steps.length} steps, each measured in Qloo; every number above comes from a step.</p>
              {proof && <p className="mt-2 max-w-[60ch] text-sm text-ink-2">{proof}</p>}
              {/* the re-judge's memorable moment lived only on /audit (Fable tie ruling, Oct 14) */}
              <p className="mt-2 max-w-[60ch] text-sm text-ink-2">The counterexample: Liquid Death x e.l.f. sold out in 45 minutes with weaker measured taste. Taste is one input. <Link href="/audit" className="underline decoration-rule-strong underline-offset-4 hover:text-ink">See it on the audit</Link></p>
              <p className="mt-4 flex flex-wrap gap-x-4">
                {resolved?.id && resolved.type && <CopyAsk href={askLinks(asked ?? { id: resolved.id, type: resolved.type }, { id: resolved.id, type: resolved.type }).share} />}
                {resolved?.id && resolved.type && <Link href={askLinks(asked ?? { id: resolved.id, type: resolved.type }, { id: resolved.id, type: resolved.type }).sheet} className={btnQuiet}>Call sheet: print or save as PDF</Link>}
                <Link href="/audit" className={btnQuiet}>Next: is any of this right? The audit</Link>
              </p>
            </>
          )}
          {status === "running" && !verdict && !ambiguous && (
            <p className="font-mono text-sm text-ink-2 motion-safe:animate-pulse">Measuring in Qloo: step {Math.max(1, steps.length)} of about 6. A new name takes about 40 seconds.</p>
          )}
          {ambiguous && (
            <div>
              <p className="text-lg text-ink">Which one did you mean?</p>
              <p className="mt-2 flex flex-wrap gap-x-4">{ambiguous.map((o) => <button key={o.id} type="button" onClick={() => run({ id: o.id, type: o.type })} className={btnQuiet}>{o.name} ({o.type.replace("urn:entity:", "").replace("_", " ")})</button>)}</p>
            </div>
          )}
          {verdict && !verdict.ok && status !== "running" && (
            <p className="text-base text-ink-2">{verdict.decision ? "The agent's summary didn't match its own steps, so it isn't shown. The steps are what it measured." : verdict.problems[0]}</p>
          )}
          {error && <p className="text-lg text-ink">{error}</p>}
        </section>

        <section id="steps" className="order-4 scroll-mt-4 lg:col-start-1 lg:row-start-3">
          {steps.length > 0 && <h2 className="font-display text-xl">Steps</h2>}
          <ol className="mt-3 space-y-4">
            {steps.map((s) => (
              <li key={s.n} id={`step-${s.n}`} className="scroll-mt-4 border-t border-rule pt-3">
                <p className="font-mono text-sm text-ink-3">{s.n}. {TOOL_LABEL[s.tool] ?? s.tool}</p>
                <p className="mt-1 text-base text-ink-2">{s.why}</p>
                <p className="mt-1 text-base text-ink">{s.summary || <span className="font-mono text-sm motion-safe:animate-pulse">Reading Qloo...</span>}</p>
                {forkLine(s) && <p className="mt-1 text-sm text-ink-3">{forkLine(s)}</p>}
                <Picture step={s} steps={steps} hero={hero} />
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

// The decision (Fable tie ruling, Oct 14): it leads. "Call first: X" and the agent's checked reason for X; then, when the
// review tied, its own label, smaller, with "inside a tie no order is claimed"; then the other calls; then the
// same-audience line, found or not, and the agent's notes.
function Call({ decision, steps, under }: { decision: Decision; steps: StepRecord[]; under?: React.ReactNode }) {
  const review = steps.find((s) => s.tool === "review");
  const tied = !!(review?.output as { noClearThree?: boolean } | undefined)?.noClearThree;
  const size = cardsStep(steps)?.cards.filter((c) => c.affinity !== null).length ?? 0;
  const twinsStepRec = steps.find((s) => s.tool === "twins");
  const twins = twinsStep(steps);
  const [first, ...rest] = decision.calls;
  return (
    <>
      {first && (
        <>
          <h2 className="font-display text-2xl">Call first: {nameForDisplay(first.name)}</h2>
          <p className="mt-1 text-base text-ink-2">{forDisplay(first.reason)} <Steps ns={first.steps} /></p>
          {under}
          {tied && (
            <p className="mt-3 text-sm text-ink-3">
              {review!.summary}. Inside a tie no order is claimed; the agent&apos;s {WORDS[decision.calls.length] ?? decision.calls.length} from the group of {WORDS[size] ?? size}:
            </p>
          )}
        </>
      )}
      {rest.length > 0 && (
        <ul className="mt-3 space-y-3">
          {rest.map((c, i) => (
            <li key={c.name + i} className="border-t border-rule pt-3">
              <p className="text-lg text-ink">{tied ? "" : `${i + 2}. `}{nameForDisplay(c.name)}</p>
              <p className="mt-1 text-base text-ink-2">{forDisplay(c.reason)} <Steps ns={c.steps} /></p>
            </li>
          ))}
        </ul>
      )}
      {twinsStepRec && (
        <p className="mt-3 max-w-[60ch] text-base text-ink-2">
          {twins
            ? `Same-audience check: ${displayName(twins.a)} and ${displayName(twins.b)} sit closest to each other (${twins.value.toFixed(2)}; the next pair ${twins.next.toFixed(2)}), so calling both may reach one audience twice.`
            : "Same-audience check: it ran, and no two contenders stand out as reaching the same audience."}{" "}
          <Steps ns={[twinsStepRec.n]} />
        </p>
      )}
      {[...decision.cautions, ...decision.summary].map((c) => (
        <p key={c.text} className="mt-3 max-w-[60ch] text-base text-ink-2">{forDisplay(c.text)} <Steps ns={c.steps} /></p>
      ))}
    </>
  );
}

// "Where to start" (Eric's features push, Oct 14): venues both audiences favor in the lead market, from /api/ask/where
// (cache first; computed by code beside the frozen answer). Nothing renders until it arrives, and nothing if it can't.
function WhereLine({ id, type, asked }: { id: string; type: string; asked: Body | null }) {
  const [line, setLine] = useState<string | null>(null);
  const q = new URLSearchParams({ id, t: type });
  if (asked && "query" in asked) q.set("q", asked.query);
  if (asked && "case" in asked) q.set("case", asked.case);
  const key = q.toString();
  useEffect(() => {
    let live = true;
    fetch(`/api/ask/where?${key}`).then((r) => (r.ok ? r.json() : null)).then((d: { line?: string | null } | null) => live && setLine(d?.line ?? null), () => {});
    return () => { live = false; };
  }, [key]);
  return line ? <p className="mt-1 text-base text-ink-2">{line}</p> : null;
}

// Both ways (Fable's columns ruling, Oct 15): the eight ranked in each direction, from /api/ask/both (cache first; code
// beside the frozen answer). Nothing renders until it arrives, and nothing when the ask's three don't separate.
function BothBlock({ id, type, asked }: { id: string; type: string; asked: Body | null }) {
  const [b, setB] = useState<BothWays | null>(null);
  const q = new URLSearchParams({ id, t: type });
  if (asked && "query" in asked) q.set("q", asked.query);
  if (asked && "case" in asked) q.set("case", asked.case);
  const key = q.toString();
  useEffect(() => {
    let live = true;
    fetch(`/api/ask/both?${key}`).then((r) => (r.ok ? r.json() : null)).then((d: { both?: BothWays | null } | null) => live && setB(d?.both ?? null), () => {});
    return () => { live = false; };
  }, [key]);
  return b ? <BothTable b={b} /> : null;
}

function Steps({ ns }: { ns: number[] }) {
  return <span className="font-mono text-sm text-ink-3">{ns.map((n) => <a key={n} href={`#step-${n}`} className="ml-1 underline decoration-rule-strong underline-offset-4">step {n}</a>)}</span>;
}

function CopyAsk({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  const link = () => `${window.location.origin}${href}`;
  return (
    <button type="button" className={btnQuiet} onClick={() => navigator.clipboard.writeText(link()).then(() => setCopied(true), () => {})}>
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}

// Steps 3, 5 and 6 drawn, only from the step outputs, so a picture never shows a number the checker can't see. The
// hero picture is drawn once, at the top; its step points up to it.
function Picture({ step, steps, hero }: { step: StepRecord; steps: StepRecord[]; hero: "map" | "dumbbell" | null }) {
  if (!step.output) return null;
  const above = <p className="mt-2"><a href="#hero" className={btnQuiet}>Drawn above</a></p>;
  if (step.tool === "split") return hero === "map" ? above : null;
  if (step.tool === "review") {
    if (hero === "dumbbell") return above;
    const bell = dumbbellStep(steps);
    return bell ? <Dumbbell rows={bell.rows} steps={steps} compact /> : null;
  }
  return null;
}

function MapPicture({ m, n }: { m: MapStep; n: number }) {
  const [map, setMap] = useState<VsPayload["map"] | null>(null);
  const q = new URLSearchParams({ a: m.seed.id!, ta: m.seed.type!, b: m.rival.id!, tb: m.rival.type! }).toString();
  useEffect(() => {
    // the split already ran this pair, so this is a cache read on the /vs route's own keys
    fetch(`/api/rivals?${q}`).then((r) => (r.ok ? r.json() : null)).then((d: VsPayload | null) => setMap(d?.map ?? null), () => {});
  }, [q]);
  // the city sentence is /vs's own code-generated line, from the step's market lists
  const cities = mapLine(m.seed.name, m.rival.name, { metrosA: m.seedMarkets.map((name) => ({ name })), metrosB: m.rivalMarkets.map((name) => ({ name })) } as unknown as Parameters<typeof mapLine>[2]);
  return (
    <div>
      {/* the counts and the city sentence above the map, so all three sit in the first viewport at 1280 (Pick 1 done) */}
      <p className="font-mono text-sm text-ink-3 max-sm:hidden">Step {n}: the split, {m.seed.name} against {m.rival.name}</p>
      <p className="mt-1 text-base text-ink tabular-nums max-sm:text-sm">{m.closerToSeed} brands sit closer to {m.seed.name}, {m.closerToRival} closer to {m.rival.name}, {m.withinGapOfBoth} within 0.05 of both.</p>
      {cities && <p className="mt-1 text-base text-ink max-sm:hidden">{cities}</p>}
      <div className="mt-2 aspect-[16/10] w-full max-w-sm">{map && <CollisionMap cells={map.cells} metrosA={map.metrosA} metrosB={map.metrosB} a={m.seed.name} b={m.rival.name} />}</div>
      <p className="mt-1"><Link href={m.href} prefetch={false} className={btnQuiet}>Open the full split</Link></p>
    </div>
  );
}

// Fame (Qloo popularity, hollow) and taste (affinity with the seed's fans, filled) on one 0.5 to 1 axis, one row per
// candidate, the widest taste-over-fame gap first.
function Dumbbell({ rows, steps, compact = false }: { rows: DumbbellRow[]; steps: StepRecord[]; compact?: boolean }) {
  const seed = steps.find((s) => s.tool === "resolve")?.output as { name: string; id: string; type: string } | undefined;
  const c = cardsStep(steps);
  const review = steps.find((s) => s.tool === "review");
  const cands = (steps.find((s) => s.tool === "candidates")?.output as { candidates?: { name: string; id: string }[] } | undefined)?.candidates ?? [];
  // the same eight in the candidates step's order, so Pick three reads the scores this ask already cached
  const pick = seed && cands.length ? `/pick-three?${shareQuery({ caseKey: null, seed: { name: seed.name, id: seed.id, type: seed.type }, names: cands.map((x) => ({ name: x.name, id: x.id, type: "urn:entity:brand" })), picks: [], gate: false })}` : null;
  const x = (v: number) => `${Math.max(0, Math.min(1, (v - 0.5) / 0.5)) * 100}%`;
  return (
    <div className={compact ? "mt-3" : ""}>
      {!compact && review && <p className="font-mono text-sm text-ink-3">Step {review.n}: fame against taste, {seed?.name}&apos;s fans</p>}
      {c?.fameFlat && <p className="mt-1 font-display text-lg text-ink">Fame can&apos;t tell these {WORDS[c.cards.length] ?? c.cards.length} apart. Taste can.</p>}
      <p className="mt-1 text-sm text-ink-3">
        <span className="mr-1 inline-block size-2.5 rounded-full border border-ink-2 align-middle" aria-hidden /> fame (Qloo popularity){" "}
        <span className="ml-3 mr-1 inline-block size-2.5 rounded-full bg-accent align-middle" aria-hidden /> taste (affinity with {seed?.name ?? "the seed"}&apos;s fans) · axis 0.5 to 1
      </p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
            <span className="truncate text-ink" title={displayName(r.name)}>{displayName(r.name)}</span>
            <span className="relative h-3">
              <span className="absolute inset-x-0 top-1/2 h-px bg-rule" aria-hidden />
              {r.taste !== null && r.fame !== null && (
                <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink-3" style={{ left: x(Math.min(r.fame, r.taste)), width: `calc(${x(Math.max(r.fame, r.taste))} - ${x(Math.min(r.fame, r.taste))})` }} aria-hidden />
              )}
              {r.fame !== null && <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink-2 bg-surface" style={{ left: x(r.fame) }} title={`fame ${r.fame.toFixed(2)}`} />}
              {r.taste !== null && <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ left: x(r.taste) }} title={`taste ${r.taste.toFixed(2)}`} />}
            </span>
            <span className="text-right text-ink-2 tabular-nums">{r.taste === null ? "no measurement" : r.taste.toFixed(2)}{r.fame === null && r.taste !== null ? <span className="text-ink-3"> · fame: no measurement</span> : null}</span>
          </li>
        ))}
      </ul>
      {pick && <p className="mt-2"><Link href={pick} className={btnQuiet}>Pick your own three from these {WORDS[cands.length] ?? cands.length}</Link></p>}
    </div>
  );
}
