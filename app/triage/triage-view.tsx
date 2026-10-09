"use client";

import { useState } from "react";
import type { Card } from "@/lib/slate.ts";
import { btnPrimary, btnQuiet, field, SiteHeader, Thumb, TYPE_LABEL } from "../ui";

const MAX = 15;
type Row = {
  query: string;
  state: "waiting" | "resolving" | "matched" | "ambiguous" | "not_found" | "skipped" | "error";
  card?: Card;
  candidates?: Card[];
  message?: string;
};

// One name at a time through the same resolver as the home page, so a judge's paste never fans out against Qloo.
async function resolveOne(q: string): Promise<Partial<Row>> {
  try {
    const res = await fetch(`/api/resolve?q=${encodeURIComponent(q)}`);
    const r = await res.json();
    if (!res.ok) return { state: "error", message: r.error ?? "Couldn't search Qloo" };
    if (r.status === "confident") return { state: "matched", card: r.candidates[0] };
    if (r.status === "ambiguous") return { state: "ambiguous", candidates: r.candidates };
    return { state: "not_found" };
  } catch {
    return { state: "error", message: "Couldn't search Qloo" };
  }
}

export default function TriageView() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const names = [...new Set(text.split("\n").map((l) => l.trim()).filter(Boolean))];
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const list = names.slice(0, MAX);
    if (!list.length) return;
    setBusy(true);
    setRows(list.map((query) => ({ query, state: "waiting" })));
    for (let i = 0; i < list.length; i++) {
      update(i, { state: "resolving" });
      update(i, await resolveOne(list[i]));
    }
    setBusy(false);
  }

  const done = rows.filter((r) => r.state === "matched").length;
  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
      <SiteHeader href="/" label="Find partners" />
      <section className="pt-8">
        <h1 className="font-display text-2xl sm:text-3xl">Inbound triage</h1>
        <p className="mt-2 max-w-[60ch] text-base text-ink-2">Paste the brands that want to work with you, one per line. Crossover finds each one in Qloo first, so the fit is measured on the right entity.</p>
        <form onSubmit={run} className="mt-6 grid max-w-[760px] gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-ink">Inbound names</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"Dr. Squatch\nOnnit\nHeatonist"} className={`${field} resize-y py-2.5`} />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <button disabled={busy || !names.length} className={btnPrimary}>
              {busy ? "Finding them in Qloo..." : "Find them"}
            </button>
            <span className="text-sm text-ink-3 tabular-nums">
              {names.length} of {MAX} names{names.length > MAX ? `; only the first ${MAX} will run` : ""}
            </span>
          </div>
        </form>
      </section>

      {rows.length > 0 && (
        <section className="mt-10">
          <p className="text-sm text-ink-3 tabular-nums">
            {done} of {rows.length} found
          </p>
          <ol className="mt-2 border-b border-rule">
            {rows.map((r, i) => (
              <li key={r.query} className="grid gap-x-4 gap-y-2 border-t border-rule py-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
                <p className="text-base font-semibold text-ink">{r.query}</p>
                <div className="min-w-0 text-base">
                  {r.state === "waiting" && <span className="text-ink-3">Waiting</span>}
                  {r.state === "resolving" && <span className="font-mono text-sm text-ink-3 motion-safe:animate-pulse">Looking it up in Qloo...</span>}
                  {r.state === "matched" && r.card && (
                    <span className="flex items-center gap-3">
                      <Thumb src={r.card.image} name={r.card.name} className="h-10 w-10 rounded-md" />
                      <span className="min-w-0">
                        <span className="block truncate text-ink">{r.card.name}</span>
                        <span className="block text-sm text-ink-3">{TYPE_LABEL[r.card.type] ?? "Entity"}</span>
                      </span>
                    </span>
                  )}
                  {r.state === "ambiguous" && (
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-ink-2">Which one?</span>
                      {r.candidates?.map((c) => (
                        <button key={c.entity_id + c.type} type="button" onClick={() => update(i, { state: "matched", card: c })} className={btnQuiet}>
                          {c.name} ({TYPE_LABEL[c.type] ?? "Entity"})
                        </button>
                      ))}
                      <button type="button" onClick={() => update(i, { state: "skipped" })} className={`${btnQuiet} text-ink-3`}>
                        None of these
                      </button>
                    </span>
                  )}
                  {r.state === "not_found" && <span className="text-ink-2">Qloo doesn&apos;t know this one yet.</span>}
                  {r.state === "skipped" && <span className="text-ink-3">Skipped</span>}
                  {r.state === "error" && <span className="text-danger">{r.message}</span>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
