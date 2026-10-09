"use client";

import { useEffect, useState } from "react";
import type { Card, Domain, Pick } from "@/lib/slate.ts";
import { briefMarkdown, exportFilename } from "@/lib/export.ts";
import { playbookFor } from "@/lib/playbook.ts";
import type { ProxySpec } from "./crossover";
import { BasedOn } from "./proxy-form";

type Event = { type: "trace"; text: string } | { type: "text"; delta: string } | { type: "done"; cached: boolean } | { type: "error"; message: string };
export type Decision = { status: "approved" | "declined"; reason?: string; name: string; domain: Domain };

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
  const [status, setStatus] = useState<"idle" | "writing" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const payload = JSON.stringify(body);

  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    setTrace([]); // eslint-disable-line react-hooks/set-state-in-effect -- reset for a new request or a retry
    setText("");
    setStatus("writing");
    (async () => {
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, signal: abort.signal });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Something went wrong. Try again.");
        await streamEvents(res, (e) => {
          if (e.type === "trace") setTrace((t) => [...t, e.text]);
          else if (e.type === "text") setText((t) => t + e.delta);
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

  return { trace, text, status, error };
}

export default function BriefPanel({
  seed,
  proxy,
  basedOn,
  pick,
  domain,
  decision,
  onDecide,
  onClose,
}: {
  seed: Card;
  proxy: ProxySpec | null;
  basedOn: Card[];
  pick: Pick;
  domain: Domain;
  decision?: Decision;
  onDecide: (d: Decision) => void;
  onClose: () => void;
}) {
  const body = proxy ? { proxy, pick: pick.entity_id, domain } : { entity: seed.entity_id, type: seed.type, pick: pick.entity_id, domain };
  const [attempt, setAttempt] = useState(0);
  const [approved, setApproved] = useState(decision?.status === "approved");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);
  const b = useStream("/api/brief", body, attempt);
  const mail = useStream(approved && b.status === "done" ? "/api/outreach" : null, body, attempt);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label={`Brief: ${seed.name} x ${pick.name}`}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[500px] md:rounded-none md:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">{playbookFor(seed.type).briefTitle}</p>
            <h2 className="mt-1 text-xl font-semibold leading-snug">
              {seed.name} &times; {pick.name}
            </h2>
          </div>
          <button onClick={onClose} className="shrink-0 rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100" aria-label="Close">
            Close
          </button>
        </div>

        {proxy && <BasedOn cards={basedOn} />}

        <ol className="mt-4 space-y-1 text-sm text-zinc-600">
          {b.trace.map((t, i) => (
            <li key={i}>&rarr; {t}</li>
          ))}
          {b.status === "writing" && <li className="animate-pulse text-zinc-400">&rarr; {b.text ? "Writing the brief..." : "Checking the fit in Qloo..."}</li>}
        </ol>

        <BriefText text={b.text} />

        {b.status === "error" && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {b.error}
            <button onClick={() => setAttempt((n) => n + 1)} className="ml-2 font-medium underline">
              Try again
            </button>
          </div>
        )}

        {b.status === "done" && (
          <div className="mt-8 border-t border-zinc-200 pt-5">
            {decision?.status === "declined" && !approved ? (
              <p className="text-sm text-zinc-600">You declined this pick: {decision.reason}</p>
            ) : approved ? (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Outreach draft</h3>
                {mail.status === "writing" && !mail.text && <p className="mt-2 animate-pulse text-sm text-zinc-400">Drafting the email from the brief...</p>}
                {mail.text && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 font-sans text-[14px] leading-relaxed text-zinc-900">{mail.text}</pre>}
                {mail.status === "error" && (
                  <p className="mt-2 text-sm text-red-800">
                    {mail.error}{" "}
                    <button onClick={() => setAttempt((n) => n + 1)} className="font-medium underline">
                      Try again
                    </button>
                  </p>
                )}
                {mail.status === "done" && (
                  <button
                    onClick={() => navigator.clipboard.writeText(mail.text).then(() => setCopied(true))}
                    className="mt-3 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:border-zinc-900"
                  >
                    {copied ? "Copied" : "Copy email"}
                  </button>
                )}
              </section>
            ) : declining ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reason.trim()) return;
                  onDecide({ status: "declined", reason: reason.trim().slice(0, 140), name: pick.name, domain });
                  onClose();
                }}
                className="grid gap-2"
              >
                <label className="text-sm text-zinc-600" htmlFor="decline-reason">
                  Why not this one? (one line)
                </label>
                <input id="decline-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button disabled={!reason.trim()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50">
                    Decline
                  </button>
                  <button type="button" onClick={() => setDeclining(false)} className="px-3 py-2 text-sm text-zinc-500">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setApproved(true);
                    onDecide({ status: "approved", name: pick.name, domain });
                  }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ background: "#ea580c" }}
                >
                  Approve and draft outreach
                </button>
                <button onClick={() => setDeclining(true)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:border-zinc-900">
                  Decline
                </button>
              </div>
            )}
            <p className="mt-3 text-xs text-zinc-500">Nothing is sent anywhere. Decisions stay in this browser.</p>
            <button onClick={download} className="mt-4 text-sm text-zinc-700 underline hover:text-zinc-900">
              Download brief{mail.status === "done" ? " and email" : ""} (.md)
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

// The agent writes "## " headings and "- " bullets (the prompt pins the format), so a tiny renderer is enough.
function BriefText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length)
      blocks.push(
        <ul key={blocks.length} className="mt-2 space-y-1.5 text-sm text-zinc-800">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-zinc-400">&ndash;</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>,
      );
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (l.startsWith("- ")) bullets.push(l.slice(2));
    else {
      flush();
      if (l.startsWith("## ")) blocks.push(<h3 key={blocks.length} className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">{l.slice(3)}</h3>);
      else if (l) blocks.push(<p key={blocks.length} className="mt-2 text-[15px] leading-relaxed text-zinc-900">{l}</p>);
    }
  }
  flush();
  return <div className="mt-2">{blocks}</div>;
}
