"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Card, Pick } from "@/lib/slate.ts";
import { BUCKET_LABEL, formatNames, MAX_NAMES, sortRows, type Bucket, type TriageName } from "@/lib/triage.ts";
import BriefPanel, { Skeleton } from "../brief-panel";
import { btnPrimary, btnSecondary, btnText, Chip, type ChipKind, ExampleLinks, field, MatchCard, SiteHeader, TYPE_LABEL, WhichOne, shell } from "../ui";

type Fit = {
  bucket: Bucket;
  contrast: boolean;
  nameAmongSeed: number | null;
  seedAmongName: number | null;
  topMarket: { market: string; seed: number; name: number } | null;
  sharedTags: string[];
  badge: "mutual" | "partial" | null;
  heatmapMissing: boolean;
  affinity: number;
  tags: string[];
};
type Row = {
  query: string;
  state: "waiting" | "resolving" | "matched" | "ambiguous" | "not_found" | "skipped" | "error";
  card?: Card;
  candidates?: Card[];
  message?: string;
  fit?: Fit;
  fitState?: "checking" | "done" | "missing" | "failed";
};
type Seed = { state: "idle" | "resolving" | "matched" | "ambiguous" | "not_found" | "error"; query: string; card?: Card; candidates?: Card[]; message?: string };

const BUCKET_CHIP: Record<Bucket, ChipKind> = { take: "approved", maybe: "partial", pass: "note" };

async function resolveOne(q: string): Promise<Partial<Row> & { code?: string }> {
  try {
    const res = await fetch(`/api/resolve?q=${encodeURIComponent(q)}`);
    const r = await res.json();
    if (!res.ok) return { state: "error", message: r.error ?? "Couldn't search Qloo", code: r.code };
    if (r.status === "confident") return { state: "matched", card: r.candidates[0], candidates: r.candidates.slice(1) }; // the rest back "Not it"
    if (r.status === "ambiguous") return { state: "ambiguous", candidates: r.candidates };
    return { state: "not_found" };
  } catch {
    return { state: "error", message: "Couldn't search Qloo" };
  }
}

// Ranks in words: where one side lands among the other's fans.
const words = (r: number | null) => (r === null ? "Outside their top 50" : r <= 10 ? `In their top 10 (#${r})` : `In their top 50 (#${r})`);

export default function TriageView({ initial }: { initial?: { seed: TriageName; names: TriageName[] } }) {
  const [seed, setSeed] = useState<Seed>({ state: "idle", query: "" });
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<"input" | "resolving" | "picking" | "fitting" | "done">(initial ? "fitting" : "input");
  const [table, setTable] = useState<{ summary: string; reasons: Record<string, string> } | null>(null);
  const [notice, setNotice] = useState<{ message: string; calm: boolean } | null>(null);
  const [open, setOpen] = useState<Row | null>(null);
  const source = useRef<EventSource | null>(null);
  const closeBrief = useCallback(() => setOpen(null), []);
  const names = [...new Set(text.split("\n").map((l) => l.trim()).filter(Boolean))];
  const update = (match: (r: Row) => boolean, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (match(r) ? { ...r, ...patch } : r)));

  // Both rankings for every matched name, streamed row by row, then the reasons (one model call for the table).
  function fit(seedRef: TriageName, list: TriageName[]) {
    source.current?.close();
    setPhase("fitting");
    setTable(null);
    setNotice(null);
    window.history.pushState(null, "", `/triage/${seedRef.id}?t=${encodeURIComponent(seedRef.type)}&n=${formatNames(list)}`);
    const es = new EventSource(`/api/triage?seed=${seedRef.id}&t=${encodeURIComponent(seedRef.type)}&n=${formatNames(list)}`);
    source.current = es;
    const ids = new Set(list.map((x) => x.id));
    setRows((rs) => rs.map((r) => (r.card && ids.has(r.card.entity_id) ? { ...r, fitState: "checking" } : r)));
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data);
      if (ev.type === "seed") setSeed((s) => ({ ...s, state: "matched", card: ev.card, query: s.query || ev.card.name }));
      else if (ev.type === "row") {
        const at = (r: Row) => r.card?.entity_id === ev.id;
        if (ev.missing) update(at, { fitState: "missing" });
        else if (ev.failed) update(at, { fitState: "failed" });
        else
          update(at, {
            card: ev.card,
            fitState: "done",
            fit: { bucket: ev.bucket, contrast: ev.contrast, nameAmongSeed: ev.nameAmongSeed, seedAmongName: ev.seedAmongName, topMarket: ev.topMarket, sharedTags: ev.sharedTags, badge: ev.badge, heatmapMissing: ev.heatmapMissing, affinity: ev.affinity, tags: ev.tags },
          });
      } else if (ev.type === "table") setTable({ summary: ev.summary, reasons: ev.reasons });
      else if (ev.type === "table_error") setNotice({ message: ev.message, calm: true });
      else if (ev.type === "error") {
        setNotice({ message: ev.message, calm: !!ev.code });
        setRows((rs) => rs.map((r) => (r.fitState === "checking" ? { ...r, fitState: "failed" } : r)));
        es.close();
        setPhase("done");
      } else if (ev.type === "done") {
        es.close();
        setPhase("done");
      }
    };
    es.onerror = () => {
      if (source.current !== es) return;
      es.close();
      setPhase("done");
    };
  }

  // A share link starts at the fit: rows come from the ids, and each card arrives with its row.
  useEffect(() => {
    if (!initial) return;
    setRows(initial.names.map((n) => ({ query: "", state: "matched", card: { entity_id: n.id, name: "", type: n.type, popularity: 0 } }))); // eslint-disable-line react-hooks/set-state-in-effect -- once per share link
    fit(initial.seed, initial.names);
    return () => source.current?.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per share link

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const list = names.slice(0, MAX_NAMES);
    if (!seed.query.trim() || !list.length) return;
    setPhase("resolving");
    setTable(null);
    setNotice(null);
    setRows(list.map((query) => ({ query, state: "waiting" })));
    // the seed first, then one name at a time: a paste never fans out against Qloo
    let seedCard = seed.state === "matched" ? seed.card : undefined;
    if (!seedCard) {
      setSeed((s) => ({ ...s, state: "resolving" }));
      const r = await resolveOne(seed.query.trim());
      setSeed((s) => ({ ...s, ...(r as Partial<Seed>) }));
      if (r.code) setNotice({ message: r.message ?? "", calm: true });
      seedCard = r.state === "matched" ? r.card : undefined;
    }
    for (const q of list) {
      update((r) => r.query === q, { state: "resolving" });
      const r = await resolveOne(q);
      update((x) => x.query === q, r);
      if (r.code) {
        setNotice({ message: r.message ?? "", calm: true });
        break;
      }
    }
    setPhase("picking"); // pause on the matches so a wrong one can be fixed ("Not it") before any fit call
  }

  const ready = seed.state === "matched" && seed.card && rows.some((r) => r.state === "matched") && !rows.some((r) => r.state === "ambiguous");
  const checkFit = () =>
    seed.card &&
    fit(
      { id: seed.card.entity_id, type: seed.card.type },
      rows.filter((r) => r.state === "matched" && r.card).map((r) => ({ id: r.card!.entity_id, type: r.card!.type })),
    );

  const fitted = sortRows(rows.filter((r) => r.fit).map((r) => ({ ...r, bucket: r.fit!.bucket, seedAmongName: r.fit!.seedAmongName })));
  const rest = rows.filter((r) => !r.fit);
  const seedName = seed.card?.name ?? "you";
  const partner = (r: Row): Pick | null =>
    r.card && r.fit ? { entity_id: r.card.entity_id, name: r.card.name, type: r.card.type, affinity: r.fit.affinity, popularity: r.card.popularity, short_description: r.card.short_description, tags: r.fit.tags } : null;

  return (
    <main className={shell}>
      <SiteHeader href="/find" label="Find partners" />
      <section className="pt-page">
        <h1 className="font-display text-2xl sm:text-3xl">Inbound triage</h1>
        <p className="mt-2 max-w-copy text-base text-ink-2">Paste the names that have pitched you. Crossover checks where each ranks among your fans&apos; picks, and where you rank among theirs, and tells you which calls to take.</p>
        {!initial && (
          <form onSubmit={start} className="mt-6 grid max-w-[760px] gap-4">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-ink">Your brand, artist or show</span>
              <input value={seed.query} onChange={(e) => setSeed({ state: "idle", query: e.target.value })} placeholder="Liquid Death" className={field} maxLength={100} />
            </label>
            {seed.state === "ambiguous" && (
              <WhichOne options={seed.candidates ?? []} label={(c) => `${c.name} (${TYPE_LABEL[c.type] ?? "Entity"})`} onPick={(c) => setSeed((s) => ({ ...s, state: "matched", card: c, query: c.name }))} />
            )}
            {seed.state === "not_found" && <p className="text-base text-ink-2">Qloo doesn&apos;t know that one yet. Triage needs a seed Qloo knows.</p>}
            {seed.state === "matched" && seed.card && <MatchCard card={seed.card} />}
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-ink">Who pitched you (one per line)</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"Dr. Squatch\nCrocs\nYETI"} className={`${field} resize-y py-2.5`} />
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <button disabled={phase === "resolving" || phase === "fitting" || !names.length || !seed.query.trim()} className={btnPrimary}>
                {phase === "resolving" ? "Finding them in Qloo..." : phase === "fitting" ? "Checking the fit..." : "Triage"}
              </button>
              <span className="text-sm text-ink-3 tabular-nums">
                {names.length} of {MAX_NAMES} names{names.length > MAX_NAMES ? `; only the first ${MAX_NAMES} will run` : ""}
              </span>
            </div>
          </form>
        )}
        {initial && seed.card && <p className="mt-4 text-lg text-ink">For {seed.card.name}</p>}
      </section>

      {notice && (
        <div className={`mt-8 rounded-md px-4 py-3 text-base ${notice.calm ? "bg-surface-2 text-ink" : "bg-danger-tint text-danger"}`}>
          <p>{notice.message}</p>
          {notice.calm && <ExampleLinks />}
        </div>
      )}

      {phase === "picking" && ready && (
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <p className="text-base text-ink-2">Check the matches above; fix any wrong one with Not it.</p>
          <button onClick={checkFit} className={btnPrimary}>
            Check the fit
          </button>
        </div>
      )}

      {(fitted.length > 0 || phase === "fitting") && (
        <section className="mt-section border-b border-ink pb-6">
          <h2 className="font-display text-xl">The calls to take</h2>
          {table ? <p className="mt-2 max-w-copy text-lg text-pretty text-ink">{table.summary}</p> : phase === "fitting" ? <Skeleton lines={2} /> : null}
        </section>
      )}

      {rows.length > 0 && (
        <ol className="border-b border-rule">
          {[...fitted, ...rest].map((r, i) => {
            const fitRow = r.fit;
            const pick = partner(r);
            return (
              <li key={(r.card?.entity_id ?? "") + r.query + i} className="grid gap-x-6 gap-y-3 border-t border-rule py-4 md:grid-cols-[minmax(0,16rem)_1fr]">
                <div className="flex items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-ink">{r.card?.name || r.query || "..."}</p>
                    {r.card?.name && <p className="text-sm text-ink-3">{TYPE_LABEL[r.card.type] ?? "Entity"}</p>}
                    {fitRow && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Chip kind={BUCKET_CHIP[fitRow.bucket]}>{BUCKET_LABEL[fitRow.bucket]}</Chip>
                        {fitRow.contrast && <Chip kind="oneway">Contrast play</Chip>}
                        {fitRow.badge && <Chip kind={fitRow.badge} />}
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0 text-base">
                  {r.state === "waiting" && <span className="text-ink-3">Waiting</span>}
                  {r.state === "resolving" && <span className="font-mono text-sm text-ink-3 motion-safe:animate-pulse">Looking it up in Qloo...</span>}
                  {r.state === "ambiguous" && (
                    <WhichOne options={r.candidates ?? []} label={(c) => `${c.name} (${TYPE_LABEL[c.type] ?? "Entity"})`} onPick={(c) => update((x) => x === r, { state: "matched", card: c })} onNone={() => update((x) => x === r, { state: "skipped" })} />
                  )}
                  {r.state === "not_found" && <span className="text-ink-2">Not in Qloo</span>}
                  {r.state === "skipped" && <span className="text-ink-3">Skipped</span>}
                  {r.state === "error" && <span className="text-danger">{r.message}</span>}
                  {r.state === "matched" && !fitRow && r.fitState === "checking" && <span className="font-mono text-sm text-ink-3 motion-safe:animate-pulse">Checking both rankings...</span>}
                  {r.state === "matched" && !fitRow && !r.fitState && (
                    <span className="flex flex-wrap items-center gap-x-4">
                      <span className="text-ink-3">Matched</span>
                      {r.query && phase !== "fitting" && (
                        <button type="button" onClick={() => update((x) => x === r, { state: r.candidates?.length ? "ambiguous" : "not_found", card: undefined })} className={`${btnText} text-sm`}>
                          Not it
                        </button>
                      )}
                    </span>
                  )}
                  {r.fitState === "missing" && <span className="text-ink-2">Not in Qloo</span>}
                  {r.fitState === "failed" && <span className="text-ink-2">Couldn&apos;t check this one right now.</span>}
                  {fitRow && (
                    <div className="grid gap-1.5">
                      <p className="text-ink">
                        <span className="text-ink-2">Among {seedName} fans:</span> {words(fitRow.nameAmongSeed)}
                      </p>
                      <p className="text-ink">
                        <span className="text-ink-2">{seedName} among theirs:</span> {words(fitRow.seedAmongName)}
                      </p>
                      <p className="text-ink-2 tabular-nums">
                        {fitRow.topMarket ? (
                          <>
                            Best shared market: <span className="text-ink">{fitRow.topMarket.market}</span> ({seedName} {fitRow.topMarket.seed}, {r.card?.name} {fitRow.topMarket.name})
                          </>
                        ) : fitRow.heatmapMissing ? (
                          "Qloo has no US heatmap for this one, so there's no shared market to show."
                        ) : (
                          "No market in both top tens."
                        )}
                      </p>
                      {fitRow.sharedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {fitRow.sharedTags.slice(0, 5).map((t) => (
                            <span key={t} className="rounded-sm border border-rule px-2 py-0.5 text-sm text-ink-2">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {table?.reasons[r.card!.entity_id] && <p className="mt-1 max-w-copy text-ink">{table.reasons[r.card!.entity_id]}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
                        {pick && seed.card && (
                          <button onClick={() => setOpen(r)} className={`${btnSecondary} text-sm`}>
                            Write the brief
                          </button>
                        )}
                        {seed.card && r.card && (
                          <a href={`/pair/${seed.card.entity_id}/${r.card.entity_id}?ta=${encodeURIComponent(seed.card.type)}&tb=${encodeURIComponent(r.card.type)}`} className={`${btnText} text-sm`}>
                            Check this pairing
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {open && seed.card && partner(open) && (
        <BriefPanel key={open.card!.entity_id} seed={seed.card} proxy={null} basedOn={[]} pick={partner(open)!} domain={open.card!.type.replace("urn:entity:", "")} onDecide={() => {}} onClose={closeBrief} />
      )}
    </main>
  );
}
