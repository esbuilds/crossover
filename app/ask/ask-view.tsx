"use client";
// The ask (the front door since Pick A, Oct 13): the agent's steps as they arrive, a picture of the split (or, without a
// split, the fame-to-taste dumbbell) above the fold, and the decision once the checker passes it (Pick 1, Oct 14).
// initial: a cached ask the server replayed (no POST, no Qloo call); pending: a share link whose ask isn't cached yet.
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { btnPrimary, btnText, chip, field, linkInline, panel, panelStrong } from "../ui";
import CollisionMap, { MapKey } from "../vs/collision-map";
import { CHECK_RULE, claimCount, displayName, forDisplay, nameForDisplay, type Check, type Decision, type StepRecord } from "@/lib/ask/check.ts";
import { checkEdit, nudge } from "@/lib/ask/fool.ts";
import { asideNote, smallerLine, type Smaller } from "@/lib/ask/smaller-rules.ts";
import { askLinks } from "@/lib/ask/links.ts";
import { callCard, cardsStep, categoryRival, decisionEvent, forkLine, tieLine, dumbbellStep, mapStep, stepsFrom, twinsStep, type DumbbellRow, type MapStep } from "@/lib/ask/steps.ts";
import { mapLine } from "@/lib/vs.ts";
import { shareQuery } from "@/lib/review-share.ts";
import { PREPARED_ASKS, UNNAMED_ASK } from "@/lib/ask/prepared.ts";
import type { AskEvent } from "@/lib/ask/agent.ts";
import type { VsPayload } from "@/lib/rivals.ts";
import { bothLine, firstCallHeading, type BothWays } from "@/lib/ask/both-rules.ts";
import type { FieldNotes } from "@/lib/ask/field-notes.ts";
import { BothSlope, BothTable } from "./both-table";

type Body = { query: string } | { id: string; type: string } | { case: string };
const TOOL_LABEL: Record<string, string> = { resolve: "Find the name", findRival: "Find the rival", split: "The split", candidates: "Candidates", review: "Score them", twins: "Overlap check" };
type Verdict = { decision: Decision | null; ok: boolean; problems: string[] };
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"];
// Measured on cold asks real Oct 13 to 14 (Allbirds, Yeti, Dove, Cedric the Entertainer, Dr. Squatch): 5 to 6 steps,
// 9 to 22 Qloo calls, 25 to 47 seconds, plus up to 8 for the both-ways table (one per candidate, reverse-probe Oct 15).
// Rounded; update if the tools change.
const COST = "About 6 steps, about 28 Qloo calls and 40 seconds on a name nobody has asked about yet; a name already asked replays at once.";
// the same limits line Pick three's evidence shows (lib/vs.ts DOESNT_ESTABLISH, condensed)
const LIMITS = "What this doesn't establish: purchases, visits, commercial eligibility, or whether the deal makes money.";
// Watch it think (moonshots round 4 pick 2): the last replayed step to land. A claim's step link is stamped once its step
// is in; Infinity (every page but the home page) means no replay and no stamps. Runs store no timings, so it's sped up.
const Landed = createContext(Infinity);
const STEP_MS = 1200;
const FIRST_MS = 500; // the first step lands sooner, so the rail isn't all pending for a full beat (MO F3)

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
// initial.where: the card's where line, read from the cache on the server, so the card is its full height at first paint
// play: the home page replays initial's steps under the ask box (Watch it think)
// initial.both, initial.notes: read from the cache on the server too (FIX-F3), so neither lands after paint and moves
// the call column while the replay plays; undefined means the server had nothing and the client fetches as before
export default function AskView({ initial, pending, proof, play = false }: { initial?: { label: string; events: AskEvent[]; asked?: Body; where?: string; both?: BothWays | null; notes?: FieldNotes | null }; pending?: { label: string; body: Body }; proof?: string; play?: boolean }) {
  const [q, setQ] = useState(initial?.label ?? (pending && pending.label !== UNNAMED_ASK ? pending.label : ""));
  const [events, setEvents] = useState<AskEvent[]>(initial?.events ?? []);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(initial ? "done" : "idle");
  const [replayed, setReplayed] = useState(!!initial); // persona round 2 (Live Nation): a replay looked like a fresh run
  const [error, setError] = useState("");
  const [asked, setAsked] = useState<Body | null>(initial?.asked ?? null);
  const steps = stepsFrom(events);
  const verdict = verdictOf(events);
  const map = mapStep(steps);
  const bell = dumbbellStep(steps);
  const hero: "map" | "dumbbell" | null = map ? "map" : bell ? "dumbbell" : null;
  const card = verdict?.ok && verdict.decision ? callCard(steps, verdict.decision) : null;
  const [landed, setLanded] = useState(play && initial ? 0 : Infinity);
  useEffect(() => {
    if (landed >= steps.length) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches; // no replay: every step lands at once
    const t = setTimeout(() => setLanded((l) => (still ? steps.length : l + 1)), still ? 0 : landed === 0 ? FIRST_MS : STEP_MS);
    return () => clearTimeout(t);
  }, [landed, steps.length]);
  const playing = landed < steps.length;
  const claims = verdict?.ok && verdict.decision ? claimCount(verdict.decision) : 0;
  const replayLine = (p: boolean) => (
    <>
      {/* phones skip the stamp sentence (the stamps are below their first screen), so both versions wrap to the same height */}
      {p ? <>Replaying the {initial?.label} run, sped up: step {Math.min(landed + 1, steps.length)} of {steps.length}.<span className="max-sm:hidden"> Each claim is stamped when the step it cites lands.</span></> : `The ${initial?.label} run, replayed from the cache: ${steps.length} steps, 0 Qloo calls.`}
    </>
  );

  const ranHere = useRef(false); // the front page keeps "/" until the visitor asks something
  async function run(body: Body) {
    setEvents([]); setError(""); setStatus("running"); setAsked(body); setLanded(Infinity); ranHere.current = true;
    // a dropped connection must not leave the button disabled (deferred minor, fixed Oct 13)
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      // 400 is a bad body; anything else is the host, not the visitor (FIX-F2)
      if (!res.ok) { setStatus("error"); setError(res.status === 400 ? "Type a name to ask about." : "Crossover's server didn't answer. Names already asked still replay; try this one again in a minute."); return; }
      let ended = false; // a stream cut off by the host's time limit sends neither done nor error (FIX-F1)
      await streamEvents(res, (e) => {
        if (e.type === "call" || e.type === "result" || e.type === "decision") setEvents((x) => [...x, e]);
        if (e.type === "done") { ended = true; setStatus("done"); setReplayed(e.cached); }
        if (e.type === "error") { ended = true; setStatus("error"); setError(e.message); }
      });
      if (!ended) { setStatus("error"); setError("The agent stopped partway. The steps above are what it measured; try again to finish."); }
    } catch {
      setStatus("error");
      setError("The connection dropped. The steps above are what the agent measured; try again to finish.");
    }
  }
  const resolved = steps.find((s) => s.tool === "resolve")?.output as { state?: string; name?: string; id?: string; type?: string; options?: { name: string; id: string; type: string }[] } | undefined;
  const answered = resolved?.id && resolved.type && verdict?.ok ? { id: resolved.id, type: resolved.type } : null;
  const seeded = asked === initial?.asked; // the server's reads belong to the ask it replayed, not to a later run
  const notes = useAskGet<FieldNotes>("field", "notes", answered, asked, seeded ? initial?.notes : undefined);
  const both = useAskGet<BothWays>("both", "both", answered, asked, seeded ? initial?.both : undefined);
  const small = useAskGet<Smaller>("smaller", "smaller", answered, asked);
  // persona test (agency strategist, Oct 14): the answer's permalink in the address bar once it arrives
  useEffect(() => {
    if (!ranHere.current || status !== "done" || !verdict?.ok || !resolved?.id || !resolved.type) return;
    const href = askLinks(asked ?? { id: resolved.id, type: resolved.type }, { id: resolved.id, type: resolved.type }).share;
    // pushState, not replaceState (FIX-F5): Back returns to the page the visitor came from in Crossover instead of
    // leaving the site; Next's router adopts the entry, so the view holds
    if (location.pathname + location.search !== href) history.pushState(null, "", href);
  }, [status, verdict?.ok, resolved?.id, resolved?.type, asked]);
  const ambiguous = resolved?.state === "ambiguous" ? resolved.options : undefined;
  const chips: { label: string; body: Body }[] = [...PREPARED_ASKS, ...(pending && !("query" in pending.body) ? [{ label: pending.label, body: pending.body }] : [])];

  // The first screen is the headline, one sentence, the box and the chips (COLDJUDGE-2, -5, real Oct 22); the cost and
  // limits lines sit under the answer, and the three stops and the tour in the footer (DC F6)
  const askBox = (
    <>
      {/* a share link whose ask isn't cached (FIX-F7): say so, and what the chip below will spend */}
      {pending && status === "idle" && events.length === 0 && (
        <p className="mt-4 max-w-lead text-base text-ink sm:mt-6">This link&apos;s answer isn&apos;t cached here yet. {"query" in pending.body ? "Press Ask to run it" : `Run ${pending.label === UNNAMED_ASK ? "it" : pending.label} from the row below`} (about 40 seconds and 28 Qloo calls), or ask another name.</p>
      )}
      <form id="ask" onSubmit={(ev) => (ev.preventDefault(), q.trim() && run({ query: q.trim() }))} className="mt-4 flex scroll-mt-4 flex-row gap-3 sm:mt-6">
        {/* maxLength is the API's own cap (lib/ask/body.ts), so a long paste can't come back as a 400 */}
        <input value={q} onChange={(ev) => setQ(ev.target.value)} maxLength={100} autoComplete="off" enterKeyHint="go" aria-label="A brand, artist, show or person" placeholder="A brand, artist, show or person" className={`${field} min-w-0 flex-1 sm:max-w-md`} />
        <button type="submit" disabled={status === "running"} className={btnPrimary}>Ask</button>
      </form>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-base">
        <span className="text-ink-2">Try:</span>
        {chips.map((p) => (
          <button key={p.label} type="button" disabled={status === "running"} onClick={() => (setQ(p.label.split(": ").at(-1)!), run(p.body))} className={chip}>{p.label}</button>
        ))}
      </p>
    </>
  );

  return (
    <Landed.Provider value={landed}>
      <section className="pt-page">
        {/* share pages name the seed, as the sheet and the tab already do (AUDIT-F5); the home replay keeps the question */}
        <AskHeadline seed={play ? undefined : resolved?.name} />
        {askBox}
        {play && initial && landed !== Infinity && (
          <div className="mt-4 sm:mt-6">
            {/* the trace rail: in the first screen at 390 and 1280, where the step list isn't */}
            <ol className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm" aria-label="The agent's steps">
              {steps.map((s) => (
                <li key={s.n} className={s.n <= landed ? "is-on" : ""}>
                  <a href={`#step-${s.n}`} onClick={() => setLanded((l) => Math.max(l, s.n))} className="rail-step">{s.n}. {TOOL_LABEL[s.tool] ?? s.tool}</a>
                </li>
              ))}
            </ol>
            {/* both versions of the line share one grid cell, so the call card below doesn't move when the replay ends */}
            {/* the button leads the line, both labels holding its width, so the end of the replay moves nothing (it used
                to follow the text and shifted when the text changed, CLS 0.006 to 0.012) */}
            <div className="mt-2 flex max-w-lead items-start gap-x-4">
              <button type="button" onClick={() => setLanded(playing ? steps.length : 0)} className={`${btnText} shrink-0 whitespace-nowrap`}>
                <span className="grid *:col-start-1 *:row-start-1"><span>{playing ? "Skip" : "Replay it"}</span><span className="invisible" aria-hidden>{playing ? "Replay it" : "Skip"}</span></span>
              </button>
              <div className="grid min-w-0 pt-3 text-sm text-ink-3 *:col-start-1 *:row-start-1">
                <p role="status">{replayLine(playing)}</p>
                <p className="invisible" aria-hidden>{replayLine(!playing)}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* phones: the call card, the picture, the decision, the steps (Fable tie ruling, Oct 14). From 1024: the card and
          the decision down the right, the picture and then the steps down the left. */}
      <div className="mt-block grid gap-x-12 gap-y-block lg:grid-cols-2 lg:items-start">
        {card && (
          <section className="order-1 lg:col-start-2 lg:row-start-1">
            <div className={`${panelStrong} p-4 sm:p-6${landed !== Infinity && !playing ? " card-stamped" : ""}`}>
              <p className="font-display text-2xl text-ink">{card.first}</p>
              {/* the fact that separates the first call, and its picture, from the both-ways rows (COLDJUDGE-8, SPECTACLE-2) */}
              {both && bothLine(both, card.name) && <p className="mt-2 max-w-copy text-lg text-ink">{bothLine(both, card.name)}</p>}
              {both && <BothSlope b={both} />}
              {card.where && <p className="mt-2 text-base text-ink-2">{card.where}</p>}
              {resolved?.id && resolved.type && <WhereLine id={resolved.id} type={resolved.type} asked={asked} seed={asked === initial?.asked ? initial?.where : undefined} />}
              {/* the replay's last beat (WOW F1): the checker's count lands on the answer itself once the last step is in.
                  Room held from the start (visibility), so the card and the picture under it never move. Home only, as the
                  step stamps are; the full checker line stays under the decision. */}
              {landed !== Infinity && (
                <p className="mt-2 font-mono text-sm" aria-hidden={playing || undefined}>
                  <span className={`stamp card-stamp${playing ? "" : " is-on"}`}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" /></svg>{claims} names and numbers checked<span className="max-sm:hidden">, each matched to the step it cites</span></span>
                </p>
              )}
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
          {verdict?.ok && verdict.decision && <Call decision={verdict.decision} steps={steps} shared={notes?.shared ?? null} both={both} />}
          {verdict?.ok && verdict.decision && (
            <>
              {/* held (invisible) while the replay plays, so its arrival doesn't shift the steps */}
              <p className={`mt-6 text-sm text-ink ${playing ? "invisible" : ""}`} aria-hidden={playing || undefined}>Checker rule {CHECK_RULE}: {claimCount(verdict.decision)} names and numbers in the agent&apos;s answer, each matched to the step it cites.</p>
              {/* counted from the steps, not from Qloo's meter: a cached replay makes no calls at all */}
              <p className="mt-2 text-sm text-ink-3">{steps.length} steps, each measured in Qloo; every number above comes from a step.{replayed ? " Replayed from an earlier run: 0 Qloo calls." : ""}</p>
              {proof && <p className="mt-2 max-w-copy text-sm text-ink-2">{proof} <Link href="/replay" className={linkInline}>Real deals: try the 23 yourself</Link></p>}
              {/* the re-judge's memorable moment lived only on /audit (Fable tie ruling, Oct 14) */}
              <p className="mt-2 max-w-copy text-sm text-ink-2">The counterexample: Liquid Death x e.l.f. sold out in 45 minutes with weaker measured taste. Taste is one input. <Link href="/audit" className={linkInline}>See it on the audit</Link></p>
              <p className="mt-2 max-w-copy text-sm text-ink-3">{LIMITS}</p>
              <p className="mt-1 max-w-copy text-sm text-ink-3">{COST}</p>
              <p className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
                {resolved?.id && resolved.type && <CopyAsk href={askLinks(asked ?? { id: resolved.id, type: resolved.type }, { id: resolved.id, type: resolved.type }).share} />}
                {resolved?.id && resolved.type && <Link href={askLinks(asked ?? { id: resolved.id, type: resolved.type }, { id: resolved.id, type: resolved.type }).sheet} className={btnText}>Call sheet: print or save as PDF</Link>}
                <Link href="/audit" className={btnText}>Next: is any of this right? The audit</Link>
              </p>
            </>
          )}
          {/* below the "every number above comes from a step" line: these numbers are code's, not the agent's steps */}
          {verdict?.ok && small && <SmallerBlock s={small} steps={steps} />}
          {status === "running" && !verdict && !ambiguous && (
            <p className="working font-mono text-sm text-ink-2" role="status">Measuring in Qloo: step {Math.max(1, steps.length)} of about 6. A new name takes about 40 seconds.</p>
          )}
          {ambiguous && (
            <div>
              <p className="text-lg text-ink">Which one did you mean?</p>
              <p className="mt-2 flex flex-wrap gap-2">{ambiguous.map((o) => <button key={o.id} type="button" onClick={() => run({ id: o.id, type: o.type })} className={chip}>{o.name} ({o.type.replace("urn:entity:", "").replace("_", " ")})</button>)}</p>
            </div>
          )}
          {verdict && !verdict.ok && status !== "running" && (
            <p className="text-base text-ink-2" role="status">{verdict.decision ? "The agent's summary didn't match its own steps, so it isn't shown. The steps are what it measured." : verdict.problems[0]}</p>
          )}
          {/* role=alert: a dropped run or a cap is read out, not only seen (FIX-F9) */}
          {error && <p className="text-lg text-ink" role="alert">{error}</p>}
        </section>

        <section id="steps" className="order-4 scroll-mt-4 lg:col-start-1 lg:row-start-3">
          {steps.length > 0 && <h2 className="font-display text-xl">Steps</h2>}
          <ol className="mt-4 space-y-6">
            {/* every step holds its room from the start, so the grid doesn't re-row as the replay lands them (MO F4) */}
            {steps.map((s) => (
              <li key={s.n} id={`step-${s.n}`} aria-hidden={s.n > landed || undefined} className={`scroll-mt-4 border-t border-rule pt-4 ${s.n > landed ? "invisible" : landed !== Infinity ? "motion-safe:animate-[step-in_360ms_cubic-bezier(0.22,1,0.36,1)_backwards]" : ""}`}>
                <p className="font-mono text-sm text-ink-3">{s.n}. {TOOL_LABEL[s.tool] ?? s.tool}</p>
                <p className="mt-1 text-base text-ink-2">{s.why}</p>
                <p className="mt-1 text-base text-ink">{s.summary || (status === "running" ? <span className="working font-mono text-sm">Reading Qloo...</span> : <span className="text-ink-2">Qloo didn&apos;t answer this step; the steps above are what was measured.</span>)}</p>
                {forkLine(s) && <p className="mt-1 text-sm text-ink-3">{forkLine(s)}</p>}
                {s.tool === "candidates" && notes?.cut && <p className="mt-1 text-sm text-ink-3 motion-safe:animate-[fade-in_200ms_ease-out]">{notes.cut}</p>}
                <Picture step={s} steps={steps} hero={hero} />
              </li>
            ))}
          </ol>
        </section>
      </div>

    </Landed.Provider>
  );
}

// The headline, shared with the home page's loading state (FIX-F4) so the cache read swaps nothing a judge has read
export function AskHeadline({ seed }: { seed?: string }) {
  return (
    <>
      <h1 className="font-display text-2xl sm:text-3xl">{seed ? `Who should ${displayName(seed)} call first?` : "One name in. Who should they call first?"}</h1>
      <p className="mt-3 max-w-lead text-lg text-ink-2 sm:mt-4">
        {/* phones get the short line, so the card and the map's top edge fit the first 390x800 screen (Fable tie ruling) */}
        <span className="sm:hidden">Every number comes from Qloo; every name and number in the answer is checked.</span>
        <span className="max-sm:hidden">The agent decides what to measure next and why; every number comes from Qloo, and every name and number in its answer is checked against the step it cites.</span>
      </p>
    </>
  );
}

// The decision (Fable tie ruling, Oct 14): it leads. "Call first: X" and the agent's checked reason for X; then, when the
// review tied, its own label, smaller, with "inside a tie no order is claimed"; then the other calls; then the
// same-audience line, found or not, and the agent's notes. Ink for what the agent decided (its reasons), ink-2 for its
// notes, ink-3 for caveats and captions (DC F7).
function Call({ decision, steps, shared, both }: { decision: Decision; steps: StepRecord[]; shared?: string | null; both: BothWays | null }) {
  const review = steps.find((s) => s.tool === "review");
  const tied = !!(review?.output as { noClearThree?: boolean } | undefined)?.noClearThree;
  const size = cardsStep(steps)?.cards.filter((c) => c.affinity !== null).length ?? 0;
  const twinsStepRec = steps.find((s) => s.tool === "twins");
  const twins = twinsStep(steps);
  const [first, ...rest] = decision.calls;
  const byCategory = categoryRival(steps);
  return (
    <>
      {first && (
        <>
          <h2 className="text-lg font-semibold">{firstCallHeading(both, nameForDisplay(first.name))}</h2>
          <p className="claim mt-1 text-base text-ink">{forDisplay(first.reason)} <Steps ns={first.steps} /></p>
          <FoolIt decision={decision} steps={steps} />
          {both && <div className="motion-safe:animate-[fade-in_200ms_ease-out]"><BothTable b={both} /></div>}
          {tied && (
            <p className="mt-3 text-sm text-ink-3">
              {tieLine(review!.summary, nameForDisplay(first.name), rest.length, size, WORDS)}
            </p>
          )}
        </>
      )}
      {rest.length > 0 && (
        <ul className="mt-6 space-y-4">
          {rest.map((c, i) => (
            <li key={c.name + i} className="border-t border-rule pt-4">
              <p className="text-lg text-ink">{tied ? "" : `${i + 2}. `}{nameForDisplay(c.name)}</p>
              <p className="claim mt-1 text-base text-ink">{forDisplay(c.reason)} <Steps ns={c.steps} /></p>
            </li>
          ))}
        </ul>
      )}
      {twinsStepRec && (
        <p className="claim mt-6 max-w-copy text-base text-ink-2">
          {twins
            ? `Overlap check: ${displayName(twins.a)} and ${displayName(twins.b)} sit closest to each other (${twins.value.toFixed(2)}; the next pair ${twins.next.toFixed(2)}), so calling both may reach one audience twice.`
            : "Overlap check: it ran, and no two contenders stand out as reaching the same audience."}{" "}
          <Steps ns={[twinsStepRec.n]} />
        </p>
      )}
      {decision.cautions.length + decision.summary.length > 0 && <p className="mt-6 text-sm text-ink-3">The agent&apos;s notes</p>}
      {[...decision.cautions, ...decision.summary].map((c, i, all) => (
        <div key={c.text}>
          <p className={`claim ${i ? "mt-3" : "mt-2"} max-w-copy text-base text-ink-2`}>{forDisplay(c.text)} <Steps ns={c.steps} /></p>
          {byCategory && i === all.findIndex((x) => x.text.includes(`[[${byCategory.rival}]]`)) && <p className="mt-1 max-w-copy text-sm text-ink-3">{byCategory.line}</p>}
        </div>
      ))}
      {byCategory && ![...decision.cautions, ...decision.summary].some((x) => x.text.includes(`[[${byCategory.rival}]]`)) && <p className="mt-3 max-w-copy text-sm text-ink-3">{byCategory.line}</p>}
      {shared && <p className="mt-4 max-w-copy text-base text-ink-2">{shared}</p>}
    </>
  );
}

// "Where to start" (Eric's features push, Oct 14): venues both audiences favor in the lead market, from /api/ask/where
// (cache first; computed by code beside the frozen answer). Nothing renders until it arrives, and nothing if it can't.
// seed: the line the server already read, so there's no fetch and nothing arrives late; a fetched line fades in (MO F6).
function WhereLine({ id, type, asked, seed }: { id: string; type: string; asked: Body | null; seed?: string }) {
  const [line, setLine] = useState<string | null>(null);
  const q = new URLSearchParams({ id, t: type });
  if (asked && "query" in asked) q.set("q", asked.query);
  if (asked && "case" in asked) q.set("case", asked.case);
  const key = q.toString();
  useEffect(() => {
    if (seed) return;
    let live = true;
    fetch(`/api/ask/where?${key}`).then((r) => (r.ok ? r.json() : null)).then((d: { line?: string | null } | null) => live && setLine(d?.line ?? null), () => {});
    return () => { live = false; };
  }, [key, seed]);
  if (seed) return <p className="mt-1 text-base text-ink-2">{seed}</p>;
  return line ? <p className="mt-1 text-base text-ink-2 motion-safe:animate-[fade-in_200ms_ease-out]">{line}</p> : null;
}

// Code beside the frozen answer, from a cached ask (cache first): /api/ask/both, the eight ranked in each direction
// (Fable's columns ruling, Oct 15), and /api/ask/field, the field notes (checker sign-off, Oct 15). null until it arrives.
// given: the value the server already read (FIX-F3); a null from the server was a cold cache, so the client still asks
function useAskGet<T>(path: "both" | "field" | "smaller", field: "both" | "notes" | "smaller", seed: { id: string; type: string } | null, asked: Body | null, given?: T | null): T | null {
  const [v, setV] = useState<T | null>(given ?? null);
  const q = seed ? new URLSearchParams({ id: seed.id, t: seed.type }) : null;
  if (q && asked && "query" in asked) q.set("q", asked.query);
  if (q && asked && "case" in asked) q.set("case", asked.case);
  const key = q?.toString() ?? "";
  useEffect(() => {
    if (!key) return setV(null);
    if (given) return setV(given);
    let live = true;
    fetch(`/api/ask/${path}?${key}`).then((r) => (r.ok ? r.json() : null)).then((d: Record<string, T | null> | null) => live && setV(d?.[field] ?? null), () => {});
    return () => { live = false; };
  }, [key, path, field, given]);
  return v;
}

// Smaller names, nearly the same fit (moonshots round 4 pick 5, real Oct 18): Qloo's list for the seed's fans, capped by
// popularity, beside the frozen answer. Code, not the agent; nothing above is reordered.
function SmallerBlock({ s, steps }: { s: Smaller; steps: StepRecord[] }) {
  const found = steps.find((x) => x.tool === "findRival");
  const pick = (found?.output as { rival?: { name: string } } | undefined)?.rival;
  const aside = asideNote(s, found && pick ? { name: pick.name, step: found.n } : null);
  return (
    <section className="mt-8 border-t border-rule pt-6 motion-safe:animate-[fade-in_200ms_ease-out]">
      <h3 className="text-lg font-semibold">Smaller names, nearly the same fit</h3>
      <p className="mt-2 max-w-copy text-base text-ink-2">{smallerLine(s, found && pick ? { name: pick.name, step: found.n } : null)}</p>
      {s.rows.length > 0 && (
        <table className="mt-4 w-full max-w-md text-sm tabular-nums">
          <thead><tr className="text-left text-ink-3"><th className="font-normal">Brand</th><th className="text-right font-normal">Fit</th><th className="text-right font-normal">Popularity</th></tr></thead>
          <tbody>
            <tr className="border-t border-rule text-ink-3"><td className="py-1">{s.leader.name} (leader{aside ? `, ${aside}` : ""})</td><td className="text-right">{s.leader.affinity.toFixed(2)}</td><td className="text-right">{s.leader.popularity.toFixed(2)}</td></tr>
            {s.rows.map((r) => <tr key={r.name} className="border-t border-rule text-ink"><td className="py-1">{r.name}</td><td className="text-right">{r.affinity.toFixed(2)}</td><td className="text-right">{r.popularity.toFixed(2)}</td></tr>)}
          </tbody>
        </table>
      )}
      <p className="mt-3 max-w-copy text-sm text-ink-3">Fit and popularity are Qloo&apos;s; the cap and the 0.05 rule are Crossover&apos;s. Brands Qloo has no popularity for are left out. Not a price: popularity stands in for how well known a brand is.</p>
    </section>
  );
}

// Break the checker (moonshots round 4, real Oct 18): edit the reason above and the same checker that gates every answer
// re-checks it here in the browser. Pure code, 0 calls; the answer itself never changes.
function FoolIt({ decision, steps }: { decision: Decision; steps: StepRecord[] }) {
  const shown = forDisplay(decision.calls[0].reason);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(shown);
  const [result, setResult] = useState<Check | null>(null);
  const check = (t: string) => setResult(checkEdit(decision, steps, shown, t));
  if (!open) return <p className="mt-2"><button type="button" onClick={() => setOpen(true)} className={btnText}>Try to fool the checker</button></p>;
  return (
    <div className={`${panel} mt-4 p-4`}>
      <p className="max-w-copy text-sm text-ink-2">Change a number or swap in another brand, then check it. The same code that gates every answer runs here, in your browser.</p>
      {/* autoFocus: the button that opened this is gone, so focus moves into the field instead of dropping to the page (FIX-F8) */}
      <textarea value={text} onChange={(ev) => (setText(ev.target.value), setResult(null))} aria-label="The first call's reason, editable" rows={3} autoFocus className={`${field} mt-2 w-full`} />
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        <button type="button" onClick={() => check(text)} className={btnPrimary}>Check it</button>
        <button type="button" onClick={() => { const t = nudge(text); setText(t); check(t); }} className={btnText}>Nudge a score</button>
        <button type="button" onClick={() => (setText(shown), setResult(null))} className={btnText}>Reset</button>
      </p>
      {result && (result.ok
        ? <p className="mt-2 text-base text-ink">Passes: every name and number traces to {decision.calls[0].steps.length === 1 ? "the step" : "the steps"} it cites.</p>
        : <div className="mt-2" role="status"><p className="text-base text-ink">Rejected. This answer wouldn&apos;t be shown:</p><ul className="mt-1 list-disc pl-5 font-mono text-sm text-ink-2">{result.problems.map((p) => <li key={p}>{forDisplay(p.replace(/^call 1: /, ""))}</li>)}</ul></div>)}
      <p className="mt-2 text-sm text-ink-3">We attacked it ourselves first: <Link href="/audit#fool-it" className={linkInline}>what it catches, and what got through</Link>.</p>
    </div>
  );
}

// on the home page's replay, "checked" lands with the step; the decision already passed the checker as a whole
function Steps({ ns }: { ns: number[] }) {
  const landed = useContext(Landed);
  // the stamp's room is held from the start (visibility), so a landing never reflows the sentence (MO F2)
  return <span className="font-mono text-sm text-ink-3">{ns.map((n) => <a key={n} href={`#step-${n}`} className={`ml-1 whitespace-nowrap ${linkInline}`}>step {n}{landed !== Infinity && (
    <span className={`stamp${n <= landed ? " is-on" : ""}`} aria-hidden={n > landed}> <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" /></svg>checked</span>
  )}</a>)}</span>;
}

function CopyAsk({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  const link = () => `${window.location.origin}${href}`;
  return (
    // aria-live: the label's change to "Link copied" is announced (FIX-F9)
    <button type="button" className={btnText} aria-live="polite" onClick={() => navigator.clipboard.writeText(link()).then(() => setCopied(true), () => {})}>
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}

// Steps 3, 5 and 6 drawn, only from the step outputs, so a picture never shows a number the checker can't see. The
// hero picture is drawn once, at the top; its step points up to it.
function Picture({ step, steps, hero }: { step: StepRecord; steps: StepRecord[]; hero: "map" | "dumbbell" | null }) {
  if (!step.output) return null;
  const above = <p className="mt-2"><a href="#hero" className={btnText}>Drawn above</a></p>;
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
  // the picture lands with its step (WOW F2): the blank states hold the room from first paint and the cells bloom when
  // the split's step lands on the rail. Infinity (no replay) shows it at once.
  const landed = useContext(Landed);
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
      {/* a plain heading, the step chip after it (COLDJUDGE-6: "Step 3:" first read as debug output) */}
      <h2 className="text-lg font-semibold text-ink">Where the two audiences split <Steps ns={[n]} /></h2>
      <p className="mt-1 max-w-copy text-base text-ink tabular-nums max-sm:text-sm">{m.closerToSeed} brands sit closer to {m.seed.name}, {m.closerToRival} closer to {m.rival.name}, {m.withinGapOfBoth} within 0.05 of both.</p>
      {cities && <p className="mt-1 max-w-copy text-base text-ink max-sm:hidden">{cities}</p>}
      <div className="mt-3 aspect-[16/10] w-full max-w-sm">{map && <CollisionMap cells={map.cells} metrosA={map.metrosA} metrosB={map.metrosB} a={m.seed.name} b={m.rival.name} reveal={landed >= n} />}</div>
      <MapKey a={m.seed.name} b={m.rival.name} sourceClass="max-sm:hidden" />
      <p className="mt-2"><Link href={m.href} prefetch={false} className={btnText}>Open the full split</Link></p>
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
      {!compact && review && <h2 className="text-lg font-semibold text-ink">Fame against taste, {seed?.name}&apos;s fans <Steps ns={[review.n]} /></h2>}
      {c?.fameFlat && <p className="mt-1 text-lg font-semibold text-ink">Fame can&apos;t tell these {WORDS[c.cards.length] ?? c.cards.length} apart. Taste can.</p>}
      {/* an artist's list is brands, not sponsors (COLDJUDGE-4): say what it shows and what it doesn't */}
      {!compact && seed?.type === "urn:entity:artist" && <p className="mt-1 max-w-copy text-sm text-ink-2">Brands {seed.name}&apos;s fans favor. It doesn&apos;t establish who sponsors tours.</p>}
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-3">
        <span><span className="mr-1 inline-block size-3 rounded-full border border-ink-2 align-middle" aria-hidden /> fame (Qloo popularity)</span>
        <span><span className="mr-1 inline-block size-3 rounded-full bg-accent align-middle" aria-hidden /> taste (affinity with {seed?.name ?? "the seed"}&apos;s fans)</span>
      </p>
      {/* one column grid shared by the axis and the rows (subgrid), so the axis track is exactly the rows' track */}
      <ul className="mt-2 grid grid-cols-[minmax(0,9rem)_1fr_auto] gap-x-2 gap-y-1.5">
        {/* the axis, drawn once (TR F7, CT F10): ticks at 0.5, 0.75 and 1 */}
        <li aria-hidden className="col-span-3 grid grid-cols-subgrid items-end text-xs text-ink-3">
          <span />
          <span className="relative h-5">
            {([["0.5", "0%", ""], ["0.75", "50%", "-translate-x-1/2"], ["1", "100%", "-translate-x-full"]] as const).map(([t, left, shift]) => (
              <span key={t}>
                <span className={`absolute bottom-1.5 ${shift}`} style={{ left }}>{t}</span>
                <span className="absolute bottom-0 h-1 w-px -translate-x-1/2 bg-rule-ui" style={{ left }} />
              </span>
            ))}
          </span>
          <span />
        </li>
        {rows.map((r, i) => (
          <li key={r.name} className="bell-row col-span-3 grid grid-cols-subgrid items-center text-sm" style={{ "--i": i } as React.CSSProperties}>
            <span className="truncate text-ink" title={displayName(r.name)}>{displayName(r.name)}</span>
            <span className="relative h-3">
              <span className="absolute inset-x-0 top-1/2 h-px bg-rule-ui" aria-hidden />
              <span className="absolute inset-y-0 left-1/2 w-px bg-rule" aria-hidden />
              {r.taste !== null && r.fame !== null && (
                // drawn from fame to taste (MO F8); the fame dot never moves, so a missing measurement never animates
                <span className="bell-line absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink-3" style={{ left: x(Math.min(r.fame, r.taste)), width: `calc(${x(Math.max(r.fame, r.taste))} - ${x(Math.min(r.fame, r.taste))})`, transformOrigin: r.fame <= r.taste ? "left" : "right" }} aria-hidden />
              )}
              {r.fame !== null && <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink-2 bg-surface" style={{ left: x(r.fame) }} title={`fame ${r.fame.toFixed(2)}`} />}
              {r.taste !== null && <span className="bell-taste absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ left: x(r.taste) }} title={`taste ${r.taste.toFixed(2)}`} />}
            </span>
            <span className="text-right text-ink-2 tabular-nums">{r.taste === null ? "no measurement" : r.taste.toFixed(2)}</span>
            {/* its own line under the track, so one long note doesn't narrow every row's track in the shared column */}
            {r.fame === null && r.taste !== null && <span className="col-span-2 col-start-2 -mt-1 text-right text-xs text-ink-3">fame: no measurement</span>}
          </li>
        ))}
      </ul>
      {pick && <p className="mt-2"><Link href={pick} className={btnText}>Pick your own three from these {WORDS[cands.length] ?? cands.length}</Link></p>}
    </div>
  );
}
