"use client";
// The ask (the front door since Pick A, Oct 13). One story top to bottom (W3, real Oct 25): who it's for and the box; the
// answer (the first call, why, the call sheet, one picture); where the audiences split; the eight, drawn once; the
// agent's picks; how it got here (the steps, folded); and the proof, one line with the long text folded under it.
// initial: a cached ask the server replayed (no POST, no Qloo call); pending: a share link whose ask isn't cached yet.
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { btnPrimary, btnSecondary, btnText, Chevron, chip, cite, field, Fold, linkInline, panelStrong } from "../ui";
import CollisionMap, { MapKey } from "../vs/collision-map";
import { CHECK_RULE, claimCount, displayName, forDisplay, nameForDisplay, type Decision, type StepRecord } from "@/lib/ask/check.ts";
import { asideNote, smallerLine, type Smaller } from "@/lib/ask/smaller-rules.ts";
import { askLinks } from "@/lib/ask/links.ts";
import { answerOf, callCard, cardsStep, categoryRival, decisionEvent, forkLine, dumbbellStep, mapStep, stepsFrom, tieOf, twinsStep, type DumbbellRow, type MapStep } from "@/lib/ask/steps.ts";
import { mapLine, poss } from "@/lib/vs.ts";
import { shareQuery } from "@/lib/review-share.ts";
import { ANSWERED, PREPARED_ASKS, UNNAMED_ASK } from "@/lib/ask/prepared.ts";
import type { AskEvent } from "@/lib/ask/agent.ts";
import type { VsPayload } from "@/lib/rivals.ts";
import { bothLine, cell as show, favoredLine, firstCallWhy, LEGEND, leftSub, noTableLine, readBoth, slope, WHO, type BothWays } from "@/lib/ask/both-rules.ts";
import type { FieldNotes } from "@/lib/ask/field-notes.ts";
import { BothSlope } from "./both-table";
import { FoolIt } from "./fool-it";

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

// proof: the checker's attacked count (lib/ask/proof.ts), passed from the server so the audit files stay off the client;
// caught: the same count in a few words, for the one proof line
// initial.asked: the body the cached ask was run with, so its share and sheet links find it (typed names are keyed by the name)
// initial.where: the card's where line, read from the cache on the server, so the card is its full height at first paint
// play: the home page replays initial's steps under the ask box (Watch it think)
// initial.both, initial.notes: read from the cache on the server too (FIX-F3), so neither lands after paint and moves
// the page while the replay plays; undefined means the server had nothing and the client fetches as before
export default function AskView({ initial, pending, proof, caught, play = false }: { initial?: { label: string; events: AskEvent[]; asked?: Body; where?: string; both?: BothWays | null; notes?: FieldNotes | null }; pending?: { label: string; body: Body }; proof?: string; caught?: string; play?: boolean }) {
  const [q, setQ] = useState(initial?.label ?? (pending && pending.label !== UNNAMED_ASK ? pending.label : ""));
  const [events, setEvents] = useState<AskEvent[]>(initial?.events ?? []);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(initial ? "done" : "idle");
  const [replayed, setReplayed] = useState(!!initial); // persona round 2 (Live Nation): a replay looked like a fresh run
  const [error, setError] = useState("");
  const [asked, setAsked] = useState<Body | null>(initial?.asked ?? null);
  const steps = stepsFrom(events);
  const latest = steps.findLast((s) => s.summary)?.summary; // the wait screen's last landed result (A-10)
  const verdict = verdictOf(events);
  const answer = answerOf(events); // checked and with a first call; an unknown name passes with none (A-1)
  const map = mapStep(steps);
  const bell = dumbbellStep(steps);
  const card = answer ? callCard(steps, answer) : null;
  const [landed, setLanded] = useState(play && initial ? 0 : Infinity);
  useEffect(() => {
    if (landed >= steps.length) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches; // no replay: every step lands at once
    const t = setTimeout(() => setLanded((l) => (still ? steps.length : l + 1)), still ? 0 : landed === 0 ? FIRST_MS : STEP_MS);
    return () => clearTimeout(t);
  }, [landed, steps.length]);
  // the home page loads at its top (W3, real Oct 25): the browser restored the last scroll position against a page still
  // streaming in, so a reload landed inside the answer (and one from the very top landed 44px down). A hash still wins.
  useEffect(() => {
    if (!play || location.hash) return;
    const was = history.scrollRestoration;
    history.scrollRestoration = "manual";
    scrollTo({ top: 0, behavior: "instant" });
    return () => void (history.scrollRestoration = was);
  }, [play]);
  // a step link (a tag, the rail, /#step-3) opens its folded step
  useEffect(() => {
    const go = () => { const m = /^#step-(\d+)$/.exec(location.hash); if (m) openStep(Number(m[1])); };
    go();
    addEventListener("hashchange", go);
    return () => removeEventListener("hashchange", go);
  }, []);
  const playing = landed < steps.length;
  const claims = answer ? claimCount(answer) : 0;
  const replayLine = (p: boolean) => (
    <>
      {/* phones skip the stamp sentence (the stamps are below their first screen), so both versions wrap to the same height */}
      {p ? <>Replaying the {initial?.label} run, sped up: step {Math.min(landed + 1, steps.length)} of {steps.length}.<span className="max-sm:hidden"> Each claim is stamped when the step it cites lands.</span></> : `The ${initial?.label} answer as the agent ran it: ${steps.length} steps, replayed from an earlier run.`}
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
      if (!ended) { setStatus("error"); setError("The agent stopped partway. The steps below are what it measured; try again to finish."); }
    } catch {
      setStatus("error");
      setError("The connection dropped. The steps below are what the agent measured; try again to finish.");
    }
  }
  const resolved = steps.find((s) => s.tool === "resolve")?.output as { state?: string; name?: string; id?: string; type?: string; options?: { name: string; id: string; type: string }[] } | undefined;
  const answered = resolved?.id && resolved.type && answer ? { id: resolved.id, type: resolved.type } : null;
  const seeded = asked === initial?.asked; // the server's reads belong to the ask it replayed, not to a later run
  const notes = useAskGet<FieldNotes>("field", "notes", answered, asked, seeded ? initial?.notes : undefined);
  const both = useAskGet<BothWays>("both", "both", answered, asked, seeded ? initial?.both : undefined);
  const small = useAskGet<Smaller>("smaller", "smaller", answered, asked);
  // persona test (agency strategist, Oct 14): the answer's permalink in the address bar once it arrives
  useEffect(() => {
    if (!ranHere.current || status !== "done" || !answer || !resolved?.id || !resolved.type) return;
    const href = askLinks(asked ?? { id: resolved.id, type: resolved.type }, { id: resolved.id, type: resolved.type }).share;
    // pushState, not replaceState (FIX-F5): Back returns to the page the visitor came from in Crossover instead of
    // leaving the site; Next's router adopts the entry, so the view holds
    if (location.pathname + location.search !== href) history.pushState(null, "", href);
  }, [status, answer, resolved?.id, resolved?.type, asked]);
  const ambiguous = resolved?.state === "ambiguous" ? resolved.options : undefined;
  const chips: { label: string; body: Body }[] = [...PREPARED_ASKS, ...(pending && !("query" in pending.body) ? [{ label: pending.label, body: pending.body }] : [])];
  const links = resolved?.id && resolved.type ? askLinks(asked ?? { id: resolved.id, type: resolved.type }, { id: resolved.id, type: resolved.type }) : null;

  // The answer (W3, real Oct 25): the first call, its reason in one sentence, the call sheet, and one picture beside them.
  // J4: inside a tie the reason says whether the both-ways read separates the first call, or that it's the agent's pick.
  const review = steps.find((s) => s.tool === "review");
  const why = card ? firstCallWhy(both, card.name, tieOf(steps)) : null;
  const line = card && both ? bothLine(both, card.name) : null;
  const favored = card ? favoredLine(both, card.name, tieOf(steps)) : null;
  const slopes = !!both && !!slope(both);
  const eightUp = !slopes && !!(bell || both); // no slopegraph (Calm): the eight is the answer's picture, drawn once
  // the pictures wait at a quarter strength until step 5 lands on the home replay, then draw; at rest everywhere else
  const drawn: "pending" | "drawn" | undefined = landed === Infinity || !review ? undefined : landed < review.n ? "pending" : "drawn";
  const calls = answer?.calls.map((c) => nameForDisplay(c.name)) ?? [];
  const rivalStep = steps.find((s) => s.tool === "findRival");
  const rivalName = (rivalStep?.output as { rival?: { name: string } } | undefined)?.rival?.name;
  const lead = small ? { name: small.leader.name, aside: asideNote(small, rivalStep && rivalName ? { name: rivalName, step: rivalStep.n } : null) } : null;

  // The first screen is the headline, one sentence, the box and the chips (COLDJUDGE-2, -5, real Oct 22); the answer
  // follows at once, and the cost and limits lines fold under it
  const askBox = (
    <>
      {/* a share link whose ask isn't cached (FIX-F7): say so, and what the chip below will spend */}
      {pending && status === "idle" && events.length === 0 && (
        <p className="mt-4 max-w-lead text-base text-ink sm:mt-6">This link&apos;s answer isn&apos;t cached here yet. {"query" in pending.body ? "Press Ask to run it" : `Run ${pending.label === UNNAMED_ASK ? "it" : pending.label} from the row below`} (about 40 seconds and 28 Qloo calls), or ask another name.</p>
      )}
      <form id="ask" onSubmit={(ev) => (ev.preventDefault(), q.trim() && run({ query: q.trim() }))} className="mt-4 flex scroll-mt-4 flex-row gap-3 sm:mt-5">
        {/* maxLength is the API's own cap (lib/ask/body.ts), so a long paste can't come back as a 400 */}
        <input value={q} onChange={(ev) => setQ(ev.target.value)} maxLength={100} autoComplete="off" enterKeyHint="go" aria-label="A brand, artist, show or person" placeholder="A brand, artist, show or person" className={`${field} min-w-0 flex-1 sm:max-w-md`} />
        {/* one primary per screen: with an answer on it, the call sheet is the primary and Ask steps down */}
        <button type="submit" disabled={status === "running"} className={card ? btnSecondary : btnPrimary}>Ask</button>
      </form>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-base">
        <span className="text-ink-2">Try:</span>
        {/* real links (AskLink); a case chip has no id to link, so it stays a button */}
        {chips.map((p) => "id" in p.body ? (
          <AskLink key={p.label} body={p.body} busy={status === "running"} go={() => { setQ(p.label.split(": ").at(-1)!); run(p.body); }}>{p.label}</AskLink>
        ) : (
          <button key={p.label} type="button" disabled={status === "running"} onClick={() => (setQ(p.label.split(": ").at(-1)!), run(p.body))} className={chip}>{p.label}</button>
        ))}
      </p>
      {/* D-2 (real Oct 27), front door only: cached household names as plain links, so a judge, a no-JS browser or an
          AI reader opens a second answer at once; the line after says what a new name costs */}
      {play && (
        <div className="mt-3 max-w-lead text-sm text-ink-2">
          <p className="leading-8">
            Already answered, no wait:{" "}
            {ANSWERED.map((a, i) => (
              // each dot rides with the name before it, so a line never starts with one
              <span key={a.label}><span className="whitespace-nowrap"><a href={askLinks(a.asked, a.seed).share} className={`${linkInline} text-ink`}>{a.label}</a>{i < ANSWERED.length - 1 && " ·"}</span>{" "}</span>
            ))}
          </p>
          <p className="mt-1 text-ink-3">A new name runs live in Qloo and takes up to about 45 seconds.</p>
        </div>
      )}
    </>
  );

  return (
    <Landed.Provider value={landed}>
      <section className="pt-page">
        {/* share pages name the seed, as the sheet and the tab already do (AUDIT-F5); the home replay keeps the question */}
        <AskHeadline seed={play ? undefined : resolved?.name} />
        {askBox}
        {play && initial && landed !== Infinity && (
          <div className="mt-4">
            {/* the trace rail: a quiet numbered progress row (DES-3), pending steps outlined, landed ones filled. Phones
                keep the numbers only, so it holds one row */}
            <ol className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="The agent's steps">
              {steps.map((s) => (
                <li key={s.n} className={s.n <= landed ? "is-on" : ""}>
                  <a href={`#step-${s.n}`} onClick={() => { setLanded((l) => Math.max(l, s.n)); openStep(s.n); }} className="rail-step"><span className="rail-num" aria-hidden>{s.n}</span><span className="sr-only">{s.n}. </span><span className="max-sm:sr-only">{TOOL_LABEL[s.tool] ?? s.tool}</span></a>
                </li>
              ))}
            </ol>
            {/* both versions of the line share one grid cell and both labels hold the button's width, so the end of the
                replay moves nothing (CLS) */}
            <div className="mt-1 flex max-w-lead items-start gap-x-3">
              {/* the button leads, both labels holding its width, so the end of the replay moves nothing */}
              <button type="button" onClick={() => setLanded(playing ? steps.length : 0)} className={`${btnText} -my-3 shrink-0 text-sm underline decoration-ink-3`}>
                <span className="grid *:col-start-1 *:row-start-1"><span>{playing ? "Skip" : "Replay it"}</span><span className="invisible" aria-hidden>{playing ? "Replay it" : "Skip"}</span></span>
              </button>
              <div className="grid min-w-0 text-sm text-ink-3 *:col-start-1 *:row-start-1">
                <p role="status">{replayLine(playing)}</p>
                <p className="invisible" aria-hidden>{replayLine(!playing)}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. The answer: one block, the reason and the call sheet on the left, the picture on the right (one column on
          phones, the picture after the actions) */}
      <section id="answer" className="mt-8 scroll-mt-4">
        {card && answer && (
          <div className={`${panelStrong} grid gap-x-12 gap-y-6 p-4 sm:px-8 sm:py-7 ${slopes || eightUp ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : ""}${landed !== Infinity && !playing ? " card-stamped" : ""}`}>
            <div className="min-w-0">
              <p className="font-display text-3xl text-ink">{card.first}</p>
              {/* the same-field cut couldn't run (A-2, real Oct 27: Arby's got "First call: Wendy's"): the caveat is the
                  card's second sentence, not a note under the picks */}
              {notes?.shared && <p className="mt-3 max-w-copy text-lg text-ink">{notes.shared}</p>}
              {why ? <p className="mt-3 max-w-copy text-lg text-ink">{why}</p> : line && <p className="mt-3 max-w-copy text-lg text-ink">{line}</p>}
              {/* not separated: the measured ranks under the plain "agent's pick", so the reader sees why */}
              {why?.endsWith("not a measured lead.") && line && <p className="mt-2 max-w-copy text-base text-ink-2">{line}</p>}
              {why?.endsWith("not a measured lead.") && favored && <p className="mt-2 max-w-copy text-base text-ink-2">{favored}</p>}
              {links && (
                <div className="mt-6">
                  <p className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <Link href={links.sheet} className={btnPrimary}>Get the call sheet</Link>
                    {/* the seller's side (W2, real Oct 24): only where the both-ways table renders */}
                    {both?.shown && <Link href={links.pitch} className={btnText}>Pitch sheet</Link>}
                    <CopyAsk href={links.share} />
                  </p>
                  <p className="mt-2 max-w-copy text-sm text-ink-3">The call sheet is the one page you send your boss{both?.shown ? "; the pitch sheet is the seller's side. Print either" : ". Print it"}, or save it as a PDF.</p>
                </div>
              )}
              <div className="mt-6 space-y-1 text-base text-ink-2">
                {card.where && <p>{card.where}</p>}
                {resolved?.id && resolved.type && <WhereLine id={resolved.id} type={resolved.type} asked={asked} seed={asked === initial?.asked ? initial?.where : undefined} />}
              </div>
              {/* the replay's last beat (WOW F1): the checker's count lands on the answer once the last step is in. Room
                  held from the start (visibility), so nothing moves. Home only, as the step stamps are */}
              {landed !== Infinity && (
                <p className="mt-4 text-sm" aria-hidden={playing || undefined}>
                  <span className={`stamp card-stamp${playing ? "" : " is-on"}`}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" /></svg>{claims} names and numbers checked<span className="max-sm:hidden">, each matched to the step it cites</span></span>
                </p>
              )}
            </div>
            {slopes ? (
              <figure className="min-w-0 [&>svg]:mt-0">
                <BothSlope b={both!} left={leftSub(both!, (review?.output as { groups?: { name: string; affinity: number }[][] } | undefined)?.groups)} drawn={drawn} />
                {/* the fact that separates the first call, and its picture (COLDJUDGE-8, SPECTACLE-2) */}
                <figcaption className="mt-3 max-w-copy text-sm text-ink-3">{readBoth(both!.seed)}</figcaption>
              </figure>
            ) : eightUp ? (
              <div className="min-w-0"><Eight rows={bell?.rows ?? null} both={both} steps={steps} calls={calls} drawn={drawn} lead={lead} /></div>
            ) : null}
          </div>
        )}
        {status === "running" && !verdict && !ambiguous && (
          <div role="status">
            <p className="working font-mono text-sm text-ink-2">Measuring in Qloo: step {Math.max(1, steps.length)} of about 6. A new name takes about 40 seconds.</p>
            {/* the wait shows what each step found as it lands (A-10, real Oct 27), not one line for 25 seconds */}
            {latest && <p className="mt-2 text-base text-ink">{latest}.</p>}
          </div>
        )}
        {ambiguous && (
          <div>
            <p className="text-lg text-ink">Which one did you mean?</p>
            <p className="mt-2 flex flex-wrap gap-2">{ambiguous.map((o) => <AskLink key={o.id} body={{ id: o.id, type: o.type }} go={() => run({ id: o.id, type: o.type })}>{o.name} ({o.type.replace("urn:entity:", "").replace("_", " ")})</AskLink>)}</p>
          </div>
        )}
        {/* a run that ends with no first call (A-1): an unknown name, or the agent stopped short; never an error screen */}
        {verdict?.ok && !answer && status !== "running" && (
          <p className="max-w-lead text-lg text-ink" role="status">
            {resolved?.state === "unresolved"
              ? <>Qloo has no entry for &ldquo;{resolved.name}&rdquo;, so there&apos;s nothing to measure. Try a brand, artist, show or person with a public following, or one of the names above.</>
              : "The agent ended without a first call. The steps below are what it measured."}
          </p>
        )}
        {verdict && !verdict.ok && status !== "running" && (
          <p className="text-base text-ink-2" role="status">{verdict.decision ? "The agent's summary didn't match its own steps, so it isn't shown. The steps are what it measured." : verdict.problems[0]}</p>
        )}
        {/* role=alert: a dropped run or a cap is read out, not only seen (FIX-F9) */}
        {error && <p className="text-lg text-ink" role="alert">{error}</p>}
      </section>

      {/* 3. Where: the map, given room */}
      {map && (
        <section id="hero" className="mt-section scroll-mt-4">
          <MapPicture m={map} n={steps.find((s) => s.tool === "split")!.n} named={[card?.where, ...(answer ? [...answer.calls.map((c) => c.reason), ...answer.cautions.map((c) => c.text), ...answer.summary.map((c) => c.text)] : [])].join(" ")} />
        </section>
      )}

      {/* 4. The eight, drawn once, where the answer's picture is the slopegraph */}
      {!eightUp && (bell || both) && (
        <section className="mt-section">
          <Eight rows={bell?.rows ?? null} both={both} steps={steps} calls={calls} drawn={drawn} lead={lead} />
        </section>
      )}

      {/* the agent's picks and their checked reasons, then the smaller names (code, not the agent; nothing above reorders) */}
      {answer && (
        <section className="mt-section">
          <Call decision={answer} steps={steps} />
          {small && <SmallerBlock s={small} steps={steps} />}
        </section>
      )}

      {/* 5. How it got here: the six steps, each folded to its result and opening to the why, the fork and the picture */}
      {/* only once there are steps: an empty one in the share page's fallback was a second #steps in the HTML */}
      {steps.length > 0 && (
      <section id="steps" className="mt-section scroll-mt-4">
        <h2 className="font-display text-xl">How it got here</h2>
        <p className="mt-1 max-w-copy text-sm text-ink-3">Each step is one measurement the agent chose to make in Qloo. Open one for what it asked and why.</p>
        <ol className="mt-4 border-b border-rule">
          {/* every step holds its room from the start, so nothing re-flows as the replay lands them (MO F4) */}
          {steps.map((s) => (
            <li key={s.n} id={`step-${s.n}`} aria-hidden={s.n > landed || undefined} className={`scroll-mt-4 border-t border-rule ${s.n > landed ? "invisible" : landed !== Infinity ? "motion-safe:animate-[step-in_240ms_cubic-bezier(0.22,1,0.36,1)_backwards]" : ""}`}>
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer items-baseline gap-x-3 py-3 text-base">
                  {/* the badge's number is drawn by CSS (data-n), so a text reader gets one line: "1. Find the name ..." */}
                  <span className="rail-num shrink-0 self-center border-ink bg-ink text-surface" data-n={s.n} aria-hidden />
                  {/* the step's name, then its result: beside it from 640, under it on phones */}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-ink sm:mr-2"><span className="sr-only">{s.n}. </span>{TOOL_LABEL[s.tool] ?? s.tool}</span>{" "}
                    <span className="text-ink-2 max-sm:block">{(s.tool === "candidates" && notes?.shared ? `${s.summary.replace(/, own field left out$/, "")}; the same-field cut couldn't run` : s.summary) || (status === "running" ? <span className="working font-mono text-sm">Reading Qloo...</span> : "Qloo didn't answer this step; the steps above are what was measured.")}</span>
                  </span>
                  <Chevron />
                </summary>
                <div className="max-w-copy pb-4 pl-8">
                  <p className="text-base text-ink-2">{s.why}</p>
                  {forkLine(s) && <p className="mt-1 text-sm text-ink-3">{forkLine(s)}</p>}
                  {s.tool === "candidates" && notes?.cut && <p className="mt-1 text-sm text-ink-3">{notes.cut}</p>}
                  <Picture step={s} map={!!map} eight={!!(bell || both)} />
                </div>
              </details>
            </li>
          ))}
        </ol>
      </section>
      )}

      {/* 6. Proof: one quiet line; the checker, the cost, the counterexample, the limits and the agent's notes fold under
          it. Every line stays in the page */}
      {answer && (
        <section className="mt-section" aria-label="How it's checked">
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
            <span className="stamp is-on">
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span>{claims} names and numbers checked against the step each came from</span>
            {caught && <><span aria-hidden className="text-ink-3">·</span><Link href="/audit#fool-it" className={`${linkInline} inline-flex min-h-11 items-center`}>{caught}</Link></>}
            <span aria-hidden className="text-ink-3">·</span>
            <FoolIt decision={answer} steps={steps} label="Try to fool it" inline />
          </div>
          {answer.cautions.length + answer.summary.length > 0 && (
            <Fold title={<>The agent&apos;s notes <span className="text-ink-3">({answer.cautions.length + answer.summary.length})</span></>}>
              <Notes decision={answer} steps={steps} />
            </Fold>
          )}
          <Fold title="How every line is checked, and what this doesn't establish">
            <p className="text-sm text-ink">Checker rule {CHECK_RULE}: {claims} names and numbers in the agent&apos;s answer, each matched to the step it cites.</p>
            {/* counted from the steps, not from Qloo's meter: a cached replay makes no calls at all */}
            <p className="mt-2 text-sm text-ink-3">{steps.length} steps, each measured in Qloo; every number above comes from a step.{replayed ? " Replayed from an earlier run: 0 Qloo calls." : ""}</p>
            {proof && <p className="mt-2 text-sm text-ink-2">{proof} <Link href="/audit#fool-it" className={linkInline}>What got through</Link></p>}
            {/* the re-judge's memorable moment lived only on /audit (Fable tie ruling, Oct 14) */}
            <p className="mt-2 text-sm text-ink-2">The counterexample: Liquid Death x e.l.f. sold out in 45 minutes with weaker measured taste. Taste is one input. <Link href="/audit" className={linkInline}>See it on the audit</Link></p>
            <p className="mt-2 text-sm text-ink-3">{LIMITS}</p>
            <p className="mt-1 text-sm text-ink-3">{WHO}{both?.shown ? ` ${LEGEND}` : ""}</p>
            <p className="mt-1 text-sm text-ink-3">{COST}</p>
          </Fold>
          <p className="mt-6"><Link href="/audit" className={btnText}>Next: is any of this right? The audit</Link></p>
        </section>
      )}
    </Landed.Provider>
  );
}

const openStep = (n: number) => {
  const d = document.querySelector<HTMLDetailsElement>(`#step-${n} details`);
  if (d) d.open = true;
};

// The headline, shared with the home page's loading state (FIX-F4) so the cache read swaps nothing a judge has read
export function AskHeadline({ seed }: { seed?: string }) {
  return (
    <>
      <h1 className="font-display text-2xl sm:text-3xl">{seed ? `Who should ${displayName(seed)} call first?` : "One name in. Who should its partnerships team call first?"}</h1>
      <p className="mt-3 max-w-lead text-lg text-ink-2">
        {/* one sentence in the HTML, so a text reader gets it once (judge round, real Oct 25); phones skip the two
            clauses, so the card and the map's top edge fit the first 390x800 screen (Fable tie ruling) */}
        Every number comes from Qloo<span className="max-sm:hidden">, the agent decides what to measure next and why,</span> and every name and number in the answer is checked<span className="max-sm:hidden"> against the step it cites</span>.
      </p>
    </>
  );
}

// The agent's picks (Fable tie ruling, Oct 14; W3, real Oct 25): the first call and the others, each with its checked
// reason. Inside a tie the list isn't numbered and says why, so "First call" above and "no order" here don't read as a
// contradiction (J4). Then the same-audience line, found or not. Ink for what the agent decided, ink-2 for its notes,
// ink-3 for caveats (DC F7). The same-field caveat moved up to the answer card (A-2, real Oct 27).
function Call({ decision, steps }: { decision: Decision; steps: StepRecord[] }) {
  const review = steps.find((s) => s.tool === "review");
  const tied = !!(review?.output as { noClearThree?: boolean } | undefined)?.noClearThree;
  const twinsStepRec = steps.find((s) => s.tool === "twins");
  const twins = twinsStep(steps);
  const n = decision.calls.length;
  return (
    <>
      <h2 className="font-display text-xl">{n === 1 ? "The agent's pick" : `The agent's ${WORDS[n] ?? n} picks`}</h2>
      {tied && <p className="mt-1 max-w-copy text-sm text-ink-3">{review!.summary}. Inside a tie no order is claimed, so the picks aren&apos;t numbered; the first call is the agent&apos;s choice among them.</p>}
      <ul className="mt-4 border-b border-rule">
        {decision.calls.map((c, i) => (
          <li key={c.name + i} className="border-t border-rule py-4">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-lg font-semibold text-ink">{tied ? "" : `${i + 1}. `}{nameForDisplay(c.name)}</span>
              {i === 0 && <span className="text-sm text-ink-3">First call</span>}
            </p>
            <p className="claim mt-1 max-w-copy text-base text-ink">{forDisplay(c.reason)} <Steps ns={c.steps} /></p>
          </li>
        ))}
      </ul>
      {twinsStepRec && (
        <p className="claim mt-4 max-w-copy text-base text-ink-2">
          {twins
            ? `Overlap check: ${displayName(twins.a)} and ${displayName(twins.b)} sit closest to each other (${twins.value.toFixed(2)}; the next pair ${twins.next.toFixed(2)}), so calling both may reach one audience twice.`
            : "Overlap check: it ran, and no two contenders stand out as reaching the same audience."}{" "}
          <Steps ns={[twinsStepRec.n]} />
        </p>
      )}
    </>
  );
}

// The agent's notes, folded under the proof line (W3): every note stays, with its steps, and the category-rival caveat
// beside the note that names the rival
function Notes({ decision, steps }: { decision: Decision; steps: StepRecord[] }) {
  const byCategory = categoryRival(steps);
  const all = [...decision.cautions, ...decision.summary];
  return (
    <>
      <ul className="list-disc space-y-2 pl-4 text-sm text-ink-2 marker:text-rule-ui">
        {all.map((c, i) => (
          <li key={c.text}>
            <p className="claim">{forDisplay(c.text)} <Steps ns={c.steps} /></p>
            {byCategory && i === all.findIndex((x) => x.text.includes(`[[${byCategory.rival}]]`)) && <p className="mt-1 text-ink-3">{byCategory.line}</p>}
          </li>
        ))}
      </ul>
      {byCategory && !all.some((x) => x.text.includes(`[[${byCategory.rival}]]`)) && <p className="mt-3 text-sm text-ink-3">{byCategory.line}</p>}
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
  if (seed) return <p>{seed}</p>;
  return line ? <p className="motion-safe:animate-[fade-in_200ms_ease-out]">{line}</p> : null;
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
    // a reset when the ask changes, as before (lint fix J3b, real Oct 25: behavior unchanged)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!key) return setV(null);
    if (given) return setV(given);
    let live = true;
    fetch(`/api/ask/${path}?${key}`).then((r) => (r.ok ? r.json() : null)).then((d: Record<string, T | null> | null) => live && setV(d?.[field] ?? null), () => {});
    return () => { live = false; };
  }, [key, path, field, given]);
  return v;
}

// Smaller names, nearly the same fit (moonshots round 4 pick 5, real Oct 18): Qloo's list for the seed's fans, capped by
// popularity, beside the frozen answer. Code, not the agent; nothing above is reordered. Folded under the picks (W3).
function SmallerBlock({ s, steps }: { s: Smaller; steps: StepRecord[] }) {
  const found = steps.find((x) => x.tool === "findRival");
  const pick = (found?.output as { rival?: { name: string } } | undefined)?.rival;
  const aside = asideNote(s, found && pick ? { name: pick.name, step: found.n } : null);
  return (
    <details className="group mt-6 border-y border-rule motion-safe:animate-[fade-in_200ms_ease-out]">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-2">
        <h3 className="text-base font-semibold">Smaller names, nearly the same fit</h3>
        <Chevron />
      </summary>
      <div className="pb-4">
        <p className="max-w-copy text-base text-ink-2">{smallerLine(s, found && pick ? { name: pick.name, step: found.n } : null)}</p>
        {s.rows.length > 0 && (
          <table className="mt-4 w-full max-w-md text-sm tabular-nums">
            <thead><tr className="text-left text-ink-3"><th className="font-normal">Brand</th><th className="text-right font-normal">Fit</th><th className="text-right font-normal">Popularity</th></tr></thead>
            <tbody>
              <tr className="border-t border-rule text-ink-3"><td className="py-1 pr-4">{s.leader.name} (leader{aside ? `, ${aside}` : ""})</td><td className="text-right align-top">{s.leader.affinity.toFixed(2)}</td><td className="text-right align-top">{s.leader.popularity.toFixed(2)}</td></tr>
              {s.rows.map((r) => <tr key={r.name} className="border-t border-rule text-ink"><td className="py-1 pr-4">{r.name}</td><td className="text-right">{r.affinity.toFixed(2)}</td><td className="text-right">{r.popularity.toFixed(2)}</td></tr>)}
            </tbody>
          </table>
        )}
        <p className="mt-3 max-w-copy text-sm text-ink-3">Fit and popularity are Qloo&apos;s; the cap and the 0.05 rule are Crossover&apos;s. Brands Qloo has no popularity for are left out. Not a price: popularity stands in for how well known a brand is.</p>
      </div>
    </details>
  );
}

// on the home page's replay, "checked" lands with the step; the decision already passed the checker as a whole. A tag
// opens the step it names (its row is folded).
function Steps({ ns }: { ns: number[] }) {
  const landed = useContext(Landed);
  // the stamp's room is held from the start (visibility), so a landing never reflows the sentence (MO F2)
  return <span>{ns.map((n) => <a key={n} href={`#step-${n}`} onClick={() => openStep(n)} className={`ml-1 ${cite} transition-colors duration-150 ease-out hover:bg-rule hover:text-ink motion-reduce:transition-none`}>step {n}{landed !== Infinity && (
    <span className={`stamp${n <= landed ? " is-on" : ""}`} aria-hidden={n > landed}> <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" /></svg>checked</span>
  )}</a>)}</span>;
}

// A chip that is a real link (judge round, real Oct 25): a text reader, a browser without JS or a modifier click follows
// the href to the ask's server-rendered page (an uncached one waits for a click, so following it never spends); a plain
// click runs it here, as the button did.
function AskLink({ body, busy = false, go, children }: { body: { id: string; type: string }; busy?: boolean; go: () => void; children: React.ReactNode }) {
  return (
    <a href={askLinks(body, body).share} aria-disabled={busy || undefined} className={`${chip} aria-disabled:text-ink-3`} onClick={(ev) => {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      if (!busy) go();
    }}>{children}</a>
  );
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

// Steps 3 and 5 are drawn once, above, from the step outputs only; the step says so and links to its picture
function Picture({ step, map, eight }: { step: StepRecord; map: boolean; eight: boolean }) {
  if (!step.output) return null;
  if (step.tool === "split" && map) return <p className="mt-2"><a href="#hero" className={btnText}>Drawn above</a></p>;
  if (step.tool === "review" && eight) return <p className="mt-2"><a href="#eight" className={btnText}>Drawn above</a></p>;
  return null;
}

// named: the answer's own text; every city it or the map's city line names keeps its label on the map. W3: the map gets
// the wide column, its sentences and key beside it (above it on phones)
function MapPicture({ m, n, named }: { m: MapStep; n: number; named: string }) {
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
      {/* a plain heading, the step chip after it (COLDJUDGE-6: "Step 3:" first read as debug output) */}
      <h2 className="font-display text-xl text-ink">Where the two audiences split <Steps ns={[n]} /></h2>
      <div className="mt-4 grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          <p className="max-w-copy text-lg text-ink tabular-nums">{m.closerToSeed} brands sit closer to {m.seed.name}, {m.closerToRival} closer to {m.rival.name}, {m.withinGapOfBoth} within 0.05 of both.</p>
          {cities && <p className="mt-2 max-w-copy text-base text-ink-2">{cities}</p>}
          <div className="mt-4"><MapKey a={m.seed.name} b={m.rival.name} sourceClass="max-sm:hidden" /></div>
          <p className="mt-2"><Link href={m.href} prefetch={false} className={btnText}>Open the full split</Link></p>
        </div>
        <div className="aspect-[16/10] w-full max-w-2xl lg:col-start-1 lg:row-start-1">{map && <CollisionMap cells={map.cells} metrosA={map.metrosA} metrosB={map.metrosB} a={m.seed.name} b={m.rival.name} reveal={landed >= n} named={`${cities ?? ""} ${named}`} />}</div>
      </div>
    </div>
  );
}

// The eight, drawn once (W3, real Oct 25). Step 5's fame and taste chart and the both-ways table were two drawings of the
// same rows; now one table carries the fame-to-taste track, the taste score and, where the both-ways read is shown, both
// ranks. Rows follow the frozen review's order (by taste) either way. Phones hide the track where the ranks are shown: the slopegraph above draws them.
// drawn: the home replay's state for step 5 (pending: a quarter strength; drawn: each row draws from fame to taste).
// lead: the smaller names' leader (the top of Qloo's brand list for the seed's fans), so the footnote can say who holds
// the places the eight don't (a judge asked "Bombas 2nd: who is 1st?")
function Eight({ rows, both, steps, calls, drawn, lead }: { rows: DumbbellRow[] | null; both: BothWays | null; steps: StepRecord[]; calls: string[]; drawn?: "pending" | "drawn"; lead?: { name: string; aside: string | null } | null }) {
  const seed = steps.find((s) => s.tool === "resolve")?.output as { name: string; id: string; type: string } | undefined;
  const c = cardsStep(steps);
  const review = steps.find((s) => s.tool === "review");
  const cands = (steps.find((s) => s.tool === "candidates")?.output as { candidates?: { name: string; id: string }[] } | undefined)?.candidates ?? [];
  // the same eight in the candidates step's order, so Pick three reads the scores this ask already cached
  const pick = seed && cands.length ? `/pick-three?${shareQuery({ caseKey: null, seed: { name: seed.name, id: seed.id, type: seed.type }, names: cands.map((x) => ({ name: x.name, id: x.id, type: "urn:entity:brand" })), picks: [], gate: false })}` : null;
  const ranks = both?.shown ? both : null;
  const track = !!rows;
  // no both-ways table (A-3, real Oct 27): rows by taste, the review's own order (scores unrounded), so the top score is
  // the top row and the picks' "ranks second" reads down the table; rows the review didn't measure go last
  const order = ((review?.output as { groups?: { name: string }[][] } | undefined)?.groups ?? []).flat().map((g) => g.name);
  const at = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length);
  // keyed by display name: both-ways rows arrive as "Alternative Apparel", dumbbell rows as Qloo's bare "Alternative"
  const byName = new Map((rows ?? []).map((r) => [displayName(r.name), r]));
  const list = ranks
    ? ranks.rows.map((r) => ({ name: r.name, call: r.call, bell: byName.get(r.name) ?? null, fwd: r.fwd, rev: r.rev }))
    : [...(rows ?? [])].sort((a, b) => at(a.name) - at(b.name)).map((r) => ({ name: r.name, call: calls.includes(displayName(r.name)), bell: r, fwd: null, rev: null }));
  const x = (v: number) => `${Math.max(0, Math.min(1, (v - 0.5) / 0.5)) * 100}%`;
  const trackCell = `w-[38%] min-w-28 ${ranks ? "max-sm:hidden" : ""}`;
  const who = seed?.name ?? both?.seed ?? "the seed";
  // the places above the eight's worst forward rank that none of them holds (Allbirds: 1st and 3rd), named as table cells
  const fwd = new Set(list.flatMap((r) => (typeof r.fwd === "number" ? [r.fwd] : [])));
  const open = fwd.size ? Array.from({ length: Math.max(...fwd) }, (_, i) => i + 1).filter((n) => !fwd.has(n)) : [];
  const gaps = !open.length ? null : open.length > 3 ? "missing places" : open.length === 1 ? `${show(open[0])} place` : `${open.slice(0, -1).map(show).join(", ")} and ${show(open.at(-1)!)} places`;
  return (
    <div id="eight" className="scroll-mt-4">
      {review && (track
        ? <h2 className="font-display text-xl text-ink">Fame against taste, {poss(who)} fans <Steps ns={[review.n]} /></h2>
        : <h2 className="font-display text-xl text-ink">Ranked both ways <Steps ns={[review.n]} /></h2>)}
      {c?.fameFlat && <p className="mt-1 text-lg font-semibold text-ink">Fame can&apos;t tell these {WORDS[c.cards.length] ?? c.cards.length} apart. Taste can.</p>}
      {/* an artist's list is brands, not sponsors (COLDJUDGE-4): say what it shows and what it doesn't */}
      {seed?.type === "urn:entity:artist" && <p className="mt-1 max-w-copy text-sm text-ink-2">Brands {seed.name}&apos;s fans favor. It doesn&apos;t establish who sponsors tours.</p>}
      {ranks?.sentence && <p className="mt-2 text-lg text-ink">{ranks.sentence}</p>}
      {ranks?.oneWay && <p className="mt-2 text-lg text-ink">{ranks.oneWay}</p>}
      {track && (
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-3">
          <span><span className="mr-1 inline-block size-3 rounded-full border border-ink-2 align-middle" aria-hidden /> fame (Qloo popularity)</span>
          <span><span className="mr-1 inline-block size-3 rounded-full bg-accent align-middle" aria-hidden /> taste (affinity with {poss(who)} fans)</span>
        </p>
      )}
      <table className={`mt-3 w-full max-w-4xl text-sm tabular-nums ${drawn === "pending" ? "eight-pending" : drawn === "drawn" ? "eight-drawn" : ""}`}>
        <thead>
          <tr className="text-left align-bottom text-ink-3">
            <th className="py-1 pr-4 font-normal">The {WORDS[list.length] ?? list.length}</th>
            {track && (
              <th className={`py-1 pr-4 font-normal ${trackCell}`}>
                {/* the axis, drawn once (TR F7, CT F10): ticks at 0.5, 0.75 and 1 */}
                <span className="relative block h-5 text-xs" aria-hidden>
                  {([["0.5", "0%", ""], ["0.75", "50%", "-translate-x-1/2"], ["1", "100%", "-translate-x-full"]] as const).map(([t, left, shift]) => (
                    <span key={t}>
                      <span className={`absolute bottom-1.5 ${shift}`} style={{ left }}>{t}</span>
                      <span className="absolute bottom-0 h-1 w-px -translate-x-1/2 bg-rule-ui" style={{ left }} />
                    </span>
                  ))}
                </span>
                <span className="sr-only">Fame and taste, 0.5 to 1</span>
              </th>
            )}
            {track && <th className="py-1 pr-4 text-right font-normal sm:whitespace-nowrap">Taste</th>}
            {ranks && <th className="py-1 pr-4 font-normal sm:whitespace-nowrap">{ranks.seed} fans rank it</th>}
            {ranks && <th className="py-1 font-normal sm:whitespace-nowrap">Its fans rank {ranks.seed}</th>}
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.name} className={`bell-row border-t border-rule ${r.call ? "text-ink" : "text-ink-2"}`} style={{ "--i": i } as React.CSSProperties}>
              <td className="py-1.5 pr-4 align-middle leading-tight">{r.call ? <span className="font-semibold">{displayName(r.name)} *</span> : displayName(r.name)}</td>
              {track && (
                <td className={`py-1.5 pr-4 align-middle ${trackCell}`}>
                  <span className="relative block h-3">
                    <span className="absolute inset-x-0 top-1/2 h-px bg-rule-ui" aria-hidden />
                    <span className="absolute inset-y-0 left-1/2 w-px bg-rule" aria-hidden />
                    {r.bell?.taste != null && r.bell.fame !== null && (
                      // drawn from fame to taste (MO F8); the fame dot never moves, so a missing measurement never animates
                      <span className="bell-line absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink-3" style={{ left: x(Math.min(r.bell.fame, r.bell.taste)), width: `calc(${x(Math.max(r.bell.fame, r.bell.taste))} - ${x(Math.min(r.bell.fame, r.bell.taste))})`, transformOrigin: r.bell.fame <= r.bell.taste ? "left" : "right" }} aria-hidden />
                    )}
                    {r.bell?.fame != null && <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink-2 bg-surface" style={{ left: x(r.bell.fame) }} title={`fame ${r.bell.fame.toFixed(2)}`} />}
                    {r.bell?.taste != null && <span className="bell-taste absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ left: x(r.bell.taste) }} title={`taste ${r.bell.taste.toFixed(2)}`} />}
                  </span>
                  {r.bell && r.bell.fame === null && r.bell.taste !== null && <span className="mt-0.5 block text-right text-xs text-ink-3">fame: no measurement</span>}
                </td>
              )}
              {track && <td className="py-1.5 pr-4 text-right align-middle sm:whitespace-nowrap">{r.bell?.taste == null ? "no measurement" : r.bell.taste.toFixed(2)}</td>}
              {ranks && <td className="py-1.5 pr-4 align-middle sm:whitespace-nowrap">{show(r.fwd)}</td>}
              {ranks && <td className="py-1.5 align-middle sm:whitespace-nowrap">{show(r.rev)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {ranks ? (
        <p className="mt-2 max-w-copy text-sm text-ink-3">* the agent&apos;s calls. &ldquo;{ranks.seed} fans rank it&rdquo; is the taste score&apos;s own order, so it restates the tie.{gaps && <> It counts every brand {ranks.seed} fans favor, so the {gaps} {gaps.includes(" ") ? "go" : "goes"} to brands outside these {WORDS[list.length] ?? list.length}{lead && !list.some((r) => r.name === lead.name) ? `; ${lead.name}${lead.aside ? `, ${lead.aside},` : ""} leads that list` : ""}.</>} &ldquo;Its fans rank {ranks.seed}&rdquo; is that brand&apos;s fans&apos; own top 50 {ranks.noun}, a different list.</p>
      ) : (
        <>
          {calls.length > 0 && <p className="mt-2 text-sm text-ink-3">* the agent&apos;s calls.</p>}
          {/* persona round 2 (Olipop lead): a withheld table said nothing; now one line says why */}
          {both && !both.shown && <p className="mt-2 max-w-copy text-sm text-ink-3">{noTableLine(both)} <Link href="/audit#both-ways" className={linkInline}>How that&apos;s decided</Link></p>}
        </>
      )}
      {pick && <p className="mt-2"><Link href={pick} className={btnText}>Pick your own three from these {WORDS[cands.length] ?? cands.length}</Link></p>}
    </div>
  );
}
