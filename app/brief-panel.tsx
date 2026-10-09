"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, Pick } from "@/lib/slate.ts";
import { briefMarkdown, exportFilename } from "@/lib/export.ts";
import { playbookFor } from "@/lib/playbook.ts";
import { figureLead, labelled, reverseFigure, sections, venueLine, type Section } from "@/lib/brief-text.ts";
import type { ProxySpec } from "./crossover";
import { BasedOn } from "./proxy-form";
import { btnPrimary, btnQuiet, btnSecondary, Chip, field } from "./ui";

type Venue = { name: string; city: string | null; price_level: number | null; affinity: number | null };
type Event =
  | { type: "trace"; text: string }
  | { type: "text"; delta: string }
  | { type: "venues"; market: string; venues: Venue[] }
  | { type: "done"; cached: boolean }
  | { type: "error"; message: string };
export type Decision = { status: "approved" | "declined"; reason?: string; name: string; domain: string };

// Reads server-sent events from a POST response (EventSource only does GET).
async function streamEvents(res: Response, onEvent: (e: Event) => void) {
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

// POSTs and streams one SSE endpoint. Text that already streamed stays when it errors.
function useStream(url: string | null, body: object, attempt: number) {
  const [trace, setTrace] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [status, setStatus] = useState<"idle" | "writing" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const payload = JSON.stringify(body);

  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    setTrace([]); // eslint-disable-line react-hooks/set-state-in-effect -- reset for a new request or a retry
    setText("");
    setVenues([]);
    setStatus("writing");
    (async () => {
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal: abort.signal });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Something went wrong. Try again.");
        await streamEvents(res, (e) => {
          if (e.type === "trace") setTrace((t) => [...t, e.text]);
          else if (e.type === "text") setText((t) => t + e.delta);
          else if (e.type === "venues") setVenues(e.venues);
          else if (e.type === "done") setStatus("done");
          else if (e.type === "error") {
            setError(e.message);
            setStatus("error");
          }
        });
      } catch (err) {
        if (!abort.signal.aborted) {
          setError((err as Error).message);
          setStatus("error");
        }
      }
    })();
    return () => abort.abort();
  }, [url, payload, attempt]);

  return { trace, text, venues, status, error };
}

export default function BriefPanel({
  seed,
  refine,
  proxy,
  basedOn,
  pick,
  domain,
  rank,
  badge,
  decision,
  onDecide,
  onClose,
}: {
  seed: Card;
  refine?: string; // the run's refine sentence, so the brief finds picks in the refined slate
  proxy: ProxySpec | null;
  basedOn: Card[];
  pick: Pick;
  domain: string;
  rank?: { n: number; of: number }; // the pick's place in its domain's slate, for the scorecard
  badge?: "mutual" | "partial" | null;
  decision?: Decision;
  onDecide: (d: Decision) => void;
  onClose: () => void;
}) {
  const body = {
    ...(proxy ? { proxy: { name: proxy.name, d: proxy.d, p: proxy.p, t: proxy.t } } : { entity: seed.entity_id, type: seed.type }),
    pick: pick.entity_id,
    domain,
    ...(refine ? { c: refine } : {}),
  };
  const [attempt, setAttempt] = useState(0);
  const [approved, setApproved] = useState(decision?.status === "approved");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);
  const [drag, setDrag] = useState(0); // px the sheet is pulled down (phones)
  const dragFrom = useRef<number | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const b = useStream("/api/brief", body, attempt);
  const mail = useStream(approved && b.status === "done" ? "/api/outreach" : null, body, attempt);
  const ready = b.status === "done";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind stays put while the sheet scrolls
    closeBtn.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  function download() {
    const md = briefMarkdown({
      seed: seed.name,
      partner: pick.name,
      basedOn: proxy ? basedOn.map((c) => c.name) : undefined,
      brief: b.text,
      outreach: mail.status === "done" ? mail.text : undefined,
      date: new Date().toISOString().slice(0, 10),
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = exportFilename(seed.name, pick.name);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Swipe down on the sheet's header to close (touch and pen only; the desktop panel has Close and Escape).
  const pull = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button:not([data-handle])")) return;
      dragFrom.current = e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => dragFrom.current !== null && setDrag(Math.max(0, e.clientY - dragFrom.current)),
    onPointerUp: () => {
      if (dragFrom.current === null) return;
      dragFrom.current = null;
      if (drag > 90) onClose();
      else setDrag(0);
    },
  };
  const declined = decision?.status === "declined" && !approved;
  const download$ = (
    <button onClick={download} disabled={!ready} className={`${btnSecondary} flex-1 sm:flex-none`} title="Download the brief as a Markdown file">
      Download
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/25 motion-safe:animate-[fade-in_200ms_ease-out]" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="brief-title"
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-lg bg-surface shadow-pop motion-safe:animate-[sheet-in_320ms_cubic-bezier(0.22,1,0.36,1)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[560px] md:rounded-none md:motion-safe:animate-[panel-in_320ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        <header {...pull} className="shrink-0 touch-none border-b border-rule px-4 pb-3 md:touch-auto md:px-7 md:pt-6 md:pb-4">
          <button data-handle onClick={onClose} aria-label="Close the brief" className="flex h-6 w-full items-center justify-center md:hidden">
            <span className="h-1 w-10 rounded-full bg-rule-strong" />
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-base text-ink-2 md:text-lg">{playbookFor(seed.type).briefTitle}</p>
              <h2 id="brief-title" className="font-display text-xl md:text-2xl">
                {seed.name} &times; {pick.name}
              </h2>
            </div>
            <button ref={closeBtn} onClick={onClose} className={btnSecondary}>
              Close
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 md:px-7">
          {proxy && <BasedOn cards={basedOn} />}
          <BriefLog trace={b.trace} writing={b.status === "writing"} hasText={!!b.text} />
          {!b.text && b.status === "writing" && <Skeleton lines={9} />}
          <BriefBody text={b.text} pick={pick} rank={rank} badge={badge} venues={b.venues} done={ready} />

          {b.status === "error" && (
            <div className="mt-6 flex flex-wrap items-center gap-x-4 rounded-md bg-danger-tint px-4 py-2 text-base text-danger">
              <span className="py-2">{b.error}</span>
              <button onClick={() => setAttempt((n) => n + 1)} className={btnQuiet}>
                Try again
              </button>
            </div>
          )}

          {approved && ready && (
            <section className="mt-10 border-t border-ink pt-6">
              <h3 className="font-display text-xl">Outreach draft</h3>
              {mail.status === "writing" && !mail.text && <Skeleton lines={6} />}
              {mail.text && <div className="mt-3 max-w-[65ch] text-base whitespace-pre-wrap text-ink">{mail.text}</div>}
              {mail.status === "error" && (
                <p className="mt-3 flex flex-wrap items-center gap-x-4 rounded-md bg-danger-tint px-4 py-2 text-base text-danger">
                  <span className="py-2">{mail.error}</span>
                  <button onClick={() => setAttempt((n) => n + 1)} className={btnQuiet}>
                    Try again
                  </button>
                </p>
              )}
            </section>
          )}
          {ready && <p className="mt-10 text-sm text-ink-3">Nothing is sent anywhere. Decisions stay in this browser.</p>}
        </div>

        <footer className="shrink-0 border-t border-rule bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-7">
          {declining ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!reason.trim()) return;
                onDecide({ status: "declined", reason: reason.trim().slice(0, 140), name: pick.name, domain });
                onClose();
              }}
              className="grid gap-2"
            >
              <label className="text-sm font-semibold text-ink" htmlFor="decline-reason">
                Why not this one?
              </label>
              <input id="decline-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} placeholder="One line, for your own notes" className={field} />
              <div className="flex gap-2">
                <button disabled={!reason.trim()} className={`${btnSecondary} flex-1 sm:flex-none`}>
                  Decline
                </button>
                <button type="button" onClick={() => setDeclining(false)} className={`${btnQuiet} px-3`}>
                  Cancel
                </button>
              </div>
            </form>
          ) : approved ? (
            <div className="flex items-center gap-2">
              <Chip kind="approved" />
              <span className="flex-1" />
              <button
                disabled={mail.status !== "done"}
                onClick={() => navigator.clipboard.writeText(mail.text).then(() => setCopied(true))}
                className={`${btnPrimary} flex-1 sm:flex-none`}
              >
                {copied ? "Copied" : "Copy email"}
              </button>
              {download$}
            </div>
          ) : declined ? (
            <div className="flex items-center gap-3">
              <Chip kind="declined" />
              <span className="min-w-0 flex-1 truncate text-base text-ink-2">{decision.reason}</span>
              {download$}
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                disabled={!ready}
                onClick={() => {
                  setApproved(true);
                  onDecide({ status: "approved", name: pick.name, domain });
                }}
                className={`${btnPrimary} flex-1 sm:flex-none`}
              >
                Approve<span className="hidden sm:inline">&nbsp;and draft outreach</span>
              </button>
              <button disabled={!ready} onClick={() => setDeclining(true)} className={`${btnSecondary} flex-1 sm:flex-none`}>
                Decline
              </button>
              {download$}
            </div>
          )}
        </footer>
      </aside>
    </>
  );
}

// Folded by default: one line saying how many Qloo checks ran. While the brief is still working, the line is the
// step in progress.
function BriefLog({ trace, writing, hasText }: { trace: string[]; writing: boolean; hasText: boolean }) {
  const checks = trace.filter((t) => /^(Checking|Finding|Looking)/.test(t)).length;
  const now = writing ? (hasText ? "Writing the brief" : (trace.at(-1) ?? "Checking the fit in Qloo")) : null;
  if (!trace.length && !now) return null;
  return (
    <details className="group mt-3 border-b border-rule">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-mono text-sm text-ink-2 hover:text-ink">
        <span className={`min-w-0 truncate ${now ? "motion-safe:animate-pulse" : ""}`}>{now ? `${now}...` : `${checks} Qloo check${checks === 1 ? "" : "s"}`}</span>
        <span className="shrink-0 text-ink-3 group-open:hidden">Show</span>
        <span className="hidden shrink-0 text-ink-3 group-open:inline">Hide</span>
      </summary>
      <ol className="space-y-1 pb-3 font-mono text-sm text-ink-2">
        {trace.map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-5 shrink-0 text-right tabular-nums text-ink-3">{i + 1}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="mt-6 space-y-3" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-3.5 rounded-sm bg-surface-2 motion-safe:animate-pulse" style={{ width: `${[92, 100, 84, 96, 70][i % 5]}%` }} />
      ))}
    </div>
  );
}

const price = (n: number | null) => (n ? "$".repeat(Math.min(4, Math.max(1, Math.round(n)))) : null);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function BriefBody({
  text,
  pick,
  rank,
  badge,
  venues,
  done,
}: {
  done: boolean;
  text: string;
  pick: Pick;
  rank?: { n: number; of: number };
  badge?: "mutual" | "partial" | null;
  venues: Venue[];
}) {
  return (
    <div className="max-w-[65ch]">
      {sections(text).map((s, i) => (
        <section key={i} className="mt-8">
          {s.heading && <h3 className="font-display text-xl">{s.heading}</h3>}
          {s.heading === "Fit scorecard" ? (
            <Scorecard s={s} pick={pick} rank={rank} badge={badge} />
          ) : s.heading === "The evidence" ? (
            <Evidence s={s} />
          ) : s.bullets.some((b) => /^(Market|Venue): /.test(b)) ? (
            <Launch s={s} venues={venues} done={done} />
          ) : (
            <Prose s={s} lead={s.heading === "The idea"} />
          )}
        </section>
      ))}
    </div>
  );
}

function Prose({ s, lead }: { s: Section; lead?: boolean }) {
  return (
    <>
      {s.paras.map((p, i) => (
        <p key={i} className={`mt-2 text-pretty ${lead ? "text-lg text-ink" : "text-base text-ink"}`}>
          {p}
        </p>
      ))}
      {s.bullets.length > 0 && (
        <ul className="mt-2 space-y-2 text-base text-ink">
          {s.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </>
  );
}

// A small table: label, figure (tabular) with the fit chip, then the model's sentence.
function Scorecard({ s, pick, rank, badge }: { s: Section; pick: Pick; rank?: { n: number; of: number }; badge?: "mutual" | "partial" | null }) {
  return (
    <dl className="mt-3 border-b border-rule">
      {s.bullets.map((b, i) => {
        const { label, body } = labelled(b);
        const figure =
          label === "Audience affinity" ? (
            <>
              {rank && `#${rank.n} of ${rank.of}, `}affinity {pick.affinity.toFixed(2)}
            </>
          ) : label === "Mutual fit" ? (
            reverseFigure(body)
          ) : null;
        const chip = label === "Mutual fit" && badge !== undefined ? <Chip kind={badge ?? "oneway"} /> : null;
        return (
          <div key={i} className="border-t border-rule py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="text-sm font-semibold text-ink">{label}</dt>
              {(figure || chip) && (
                <dd className="flex items-center gap-2 text-base font-semibold tabular-nums text-ink">
                  {figure}
                  {chip}
                </dd>
              )}
            </div>
            <dd className="mt-1 text-base text-ink-2">{body}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function Evidence({ s }: { s: Section }) {
  return (
    <ul className="mt-3 space-y-4">
      {s.bullets.map((b, i) => {
        const { lead, rest } = figureLead(b);
        return (
          <li key={i}>
            {lead && <p className="text-lg font-semibold tabular-nums text-ink">{lead}</p>}
            <p className={`text-base ${lead ? "text-ink-2" : "text-ink"}`}>{rest}</p>
          </li>
        );
      })}
    </ul>
  );
}

function Launch({ s, venues, done }: { s: Section; venues: Venue[]; done: boolean }) {
  const rows = s.bullets.map(labelled);
  const venueRows = rows.filter((r) => r.label === "Venue").slice(0, 3);
  return (
    <div className="mt-3">
      {s.paras.map((p, i) => (
        <p key={i} className="mt-2 text-base text-ink">
          {p}
        </p>
      ))}
      {rows
        .filter((r) => r.label === "Market")
        .map((r, i) => {
          const { name, rest } = venueLine(r.body.replace(/^([^:.]+):\s/, "$1. "));
          return (
            <div key={i} className="border-t border-rule py-3">
              <p className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-semibold text-ink">Market</span>
                <span className="text-lg font-semibold text-ink">{name}</span>
              </p>
              {rest && <p className="mt-1 text-base text-ink-2">{rest}</p>}
            </div>
          );
        })}
      {done && !venueRows.length && <p className="border-t border-rule py-3 text-base text-ink-2">Qloo found no venues both audiences favor in this market.</p>}
      {venueRows.length > 0 && (
        <ul className="border-t border-rule">
          {venueRows.map((r, i) => {
            const v = venueLine(r.body);
            const hit = venues.find((x) => norm(x.name).startsWith(norm(v.name)) || norm(v.name).startsWith(norm(x.name)));
            return (
              <li key={i} className="border-b border-rule py-3 last:border-b-0">
                <p className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0">
                    <span className="text-base font-semibold text-ink">{v.name}</span>
                    {v.area && <span className="text-sm text-ink-3"> &middot; {v.area}</span>}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-ink-2">
                    {hit && price(hit.price_level) && <span title="Price level">{price(hit.price_level)}</span>}
                    {hit?.affinity && <span className="ml-3">{hit.affinity.toFixed(2)}</span>}
                  </span>
                </p>
                {v.rest && <p className="mt-1 text-base text-ink-2">{v.rest}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {rows
        .filter((r) => r.label !== "Market" && r.label !== "Venue")
        .map((r, i) => (
          <div key={i} className="border-t border-rule py-3">
            {r.label && <p className="text-sm font-semibold text-ink">{r.label}</p>}
            <p className="mt-1 text-base text-ink">{r.body}</p>
          </div>
        ))}
    </div>
  );
}
