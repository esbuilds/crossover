"use client";
// The replay challenge's game (Fable's re-judge ruling, Oct 15). Every case comes round once, misses included, in a
// seeded order saved in the browser so a refresh resumes where it was; nothing can be skipped by reloading. The reveal
// shows the published rank and score even when the protocol missed. Two tallies, never pooled.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { btnPrimary, btnText, linkInline } from "../ui";
import type { ChallengeCase } from "@/lib/replay-challenge.ts";
import { rotation } from "@/lib/replay-rotation.ts";

type Tally = { hits: number; scored: number; need: number };
type Saved = { seed: number; at: number; picks: Record<string, string> };
const KEY = "crossover:replay-challenge:v1";

const load = (): Saved | null => { try { const v = localStorage.getItem(KEY); return v ? (JSON.parse(v) as Saved) : null; } catch { return null; } };
const save = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: the game still works, it just won't resume */ } };
const whose = (n: string) => (n.endsWith("s") ? `${n}'` : `${n}'s`);
// after a pick the verdict can sit below a phone's fold; after Next the question can sit above it (challenge persona, Oct 15)
const bringIntoView = (id: string, always = false) => requestAnimationFrame(() => {
  const el = document.getElementById(id);
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (always ? r.top < 0 || r.top > innerHeight : r.bottom > innerHeight) el.scrollIntoView({ behavior: "smooth", block: "start" });
});
const th = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

export default function Challenge({ cases, protocol, strip }: { cases: ChallengeCase[]; protocol: { v1: Tally; v2: Tally; line: string }; strip: ReactNode }) {
  const [state, setState] = useState<Saved | null>(null);
  // localStorage exists only after mount, so the saved run is read here, not in useState (no hydration mismatch)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setState(load() ?? { seed: Math.floor(Math.random() * 2 ** 31) + 1, at: 0, picks: {} }), []);
  useEffect(() => { if (state) save(state); }, [state]);
  if (!state) return <p className="mt-6 min-h-64 text-sm text-ink-3">Shuffling the cases...</p>;

  const order = rotation(cases.map((c) => c.key), state.seed);
  const done = state.at >= order.length;
  const c = done ? null : cases.find((x) => x.key === order[state.at])!;
  const picked = c ? state.picks[c.key] : undefined;
  const answered = Object.entries(state.picks);
  const mine = answered.filter(([k, v]) => cases.find((x) => x.key === k)?.partner === v).length;

  return (
    <section className="mt-block">
      <p id="case-top" className="scroll-mt-4 font-mono text-sm text-ink-3">{done ? `All ${order.length} done` : `Case ${state.at + 1} of ${order.length}`}</p>

      {c && (
        <>
          <h2 className="mt-2 font-display text-xl">Which of these did {c.seed} actually partner with?</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {c.eight.map((x, i) => {
              const isReal = x.name === c.partner, isPick = x.name === picked;
              const tone = !picked ? "border-rule-ui hover:border-ink" : isReal ? "border-accent bg-accent/10" : isPick ? "border-ink-2" : "border-rule opacity-70";
              return (
                <li key={x.name}>
                  <button type="button" disabled={!!picked} onClick={() => { setState({ ...state, picks: { ...state.picks, [c.key]: x.name } }); bringIntoView("verdict"); }} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-base text-ink motion-safe:transition-[border-color,background-color,opacity] motion-safe:duration-240 ${tone}`}>
                    <span>{x.name}{picked && isReal ? " (the real partner)" : picked && isPick ? " (your pick)" : ""}</span>
                    {picked && <span className="font-mono text-sm text-ink-2 motion-safe:animate-[fade-in_200ms_ease-out_backwards]" style={{ animationDelay: `${i * 40}ms` }}>{x.score.toFixed(2)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {picked && (
            <div id="verdict" className="mt-6 max-w-copy scroll-mt-4 text-base text-ink-2 motion-safe:animate-[step-in_240ms_cubic-bezier(0.22,1,0.36,1)]">
              <p className="text-lg text-ink">{picked === c.partner ? "You found it." : `It was ${c.partner}.`} {c.seed} x {c.partner}: {c.what} ({c.year}). <a href={c.source} target="_blank" rel="noreferrer" className={linkInline}>Source</a></p>
              <p className="mt-2">Under {whose(c.seed)} fans, {c.partner} scored {c.eight.find((x) => x.name === c.partner)!.score.toFixed(2)} against a top score of {c.top.toFixed(2)}, {th(c.rank)} of 8. {c.hit ? "In the top three of eight: a hit." : "Outside the top three: a miss for the test, shown as it came out."}</p>
              {c.sameEight > 1 && <p className="mt-2 text-sm text-ink-3">These eight appear in {c.sameEight} of the {cases.length} cases; decoys come from the partner&apos;s Qloo category and fame band, so deals in the same aisle share them.</p>}
              <p className="mt-3"><button type="button" onClick={() => { setState({ ...state, at: state.at + 1 }); bringIntoView("case-top", true); }} className={btnPrimary}>{state.at + 1 < order.length ? "Next case" : "See the tally"}</button></p>
            </div>
          )}
        </>
      )}

      <div className="mt-block border-t border-rule pt-6 text-base text-ink-2">
        {answered.length > 0 && <p className="text-ink">You: {mine} of {answered.length} picked the real partner. Chance, picking one of eight, is one in eight.</p>}
        {/* challenge persona (Oct 15): six numbers in one sentence; lead with the one that passed */}
        <p className="mt-1">{protocol.line} An earlier test, {protocol.v1.hits} of {protocol.v1.scored}, missed its bar. Both were frozen in git before they ran.</p>
        <p className="mt-1 text-sm text-ink-3">A hit for Qloo&apos;s data is the real partner in its top three of eight, not first. Your score and its score count different things and aren&apos;t added together.</p>
        {/* the strip names every case's real partner, so it stays folded until the last case is played (W5b, real Oct
            25: the open strip gave away the answer to the case above it) */}
        {done ? strip : (
          <details className="mt-4">
            <summary className={`${btnText} cursor-pointer`}>See all {order.length} results (this shows every answer)</summary>
            {strip}
          </details>
        )}
        <p className="mt-2 flex flex-wrap gap-x-4">
          <Link href="/audit#replays" className={btnText}>The tests on the audit</Link>
          {done && <button type="button" onClick={() => setState({ seed: Math.floor(Math.random() * 2 ** 31) + 1, at: 0, picks: {} })} className={btnText}>Start over</button>}
        </p>
      </div>
    </section>
  );
}
