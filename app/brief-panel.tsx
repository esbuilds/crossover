"use client";

import { useEffect, useState } from "react";
import type { Card, Domain, Pick } from "@/lib/slate.ts";
import type { ProxySpec } from "./crossover";
import { BasedOn } from "./proxy-form";

type Event = { type: "trace"; text: string } | { type: "text"; delta: string } | { type: "done"; cached: boolean } | { type: "error"; message: string };

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

export default function BriefPanel({
  seed,
  proxy,
  basedOn,
  pick,
  domain,
  onClose,
}: {
  seed: Card;
  proxy: ProxySpec | null;
  basedOn: Card[];
  pick: Pick;
  domain: Domain;
  onClose: () => void;
}) {
  const [trace, setTrace] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"writing" | "done" | "error">("writing");
  const [error, setError] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(proxy ? { proxy, pick: pick.entity_id, domain } : { entity: seed.entity_id, type: seed.type, pick: pick.entity_id, domain }),
          signal: abort.signal,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't write this brief right now.");
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      abort.abort();
      window.removeEventListener("keydown", onKey);
    };
  }, [seed, proxy, pick, domain, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label={`Brief: ${seed.name} x ${pick.name}`}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[480px] md:rounded-none md:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Partnership brief</p>
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
          {trace.map((t, i) => (
            <li key={i}>&rarr; {t}</li>
          ))}
          {status === "writing" && <li className="animate-pulse text-zinc-400">&rarr; {text ? "Writing the brief..." : "Checking the fit both ways in Qloo..."}</li>}
        </ol>

        {status === "error" && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <BriefText text={text} />
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
      else if (l.startsWith("Launch plan:")) blocks.push(<p key={blocks.length} className="mt-6 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">Launch city and venues: coming Wednesday.</p>);
      else if (l) blocks.push(<p key={blocks.length} className="mt-2 text-[15px] leading-relaxed text-zinc-900">{l}</p>);
    }
  }
  flush();
  return <div className="mt-2">{blocks}</div>;
}
