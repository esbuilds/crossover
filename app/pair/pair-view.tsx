"use client";
/* eslint-disable @next/next/no-img-element -- Qloo images are remote and already sized */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Card, Pick } from "@/lib/slate.ts";
import type { Pair } from "@/lib/pairing.ts";
import type { Direction } from "@/lib/fit.ts";
import type { City } from "@/lib/cities.ts";
import UsMap, { ACCENT } from "../map";
import BriefPanel from "../brief-panel";

type Side = { query: string; state: "idle" | "loading" | "picked" | "ambiguous" | "not_found" | "error"; card?: Card; candidates?: Card[]; message?: string };
const empty: Side = { query: "", state: "idle" };
const KIND: Record<Pair["kind"], string> = { affinity: "Affinity play", "one-way": "One-way", contrast: "Contrast play" };
const TYPE: Record<string, string> = { "urn:entity:brand": "Brand", "urn:entity:artist": "Artist", "urn:entity:tv_show": "TV show", "urn:entity:movie": "Film", "urn:entity:person": "Person" };

async function resolveName(q: string): Promise<Side> {
  try {
    const res = await fetch(`/api/resolve?q=${encodeURIComponent(q)}`);
    const r = await res.json();
    if (!res.ok) return { query: q, state: "error", message: r.error ?? "Couldn't search Qloo" };
    if (r.status === "confident") return { query: q, state: "picked", card: r.candidates[0] };
    if (r.status === "ambiguous") return { query: q, state: "ambiguous", candidates: r.candidates };
    return { query: q, state: "not_found" };
  } catch {
    return { query: q, state: "error", message: "Couldn't search Qloo" };
  }
}

export default function PairView({ initial }: { initial?: { a: string; b: string; ta?: string; tb?: string } }) {
  const [a, setA] = useState<Side>(empty);
  const [b, setB] = useState<Side>(empty);
  const [pair, setPair] = useState<{ state: "idle" | "loading" | "ready" | "error"; data?: Pair; message?: string }>({ state: "idle" });
  const [brief, setBrief] = useState(false);
  const closeBrief = useCallback(() => setBrief(false), []);

  async function check(cardA: Card, cardB: Card, push = true) {
    if (push) window.history.pushState(null, "", `/pair/${cardA.entity_id}/${cardB.entity_id}?ta=${encodeURIComponent(cardA.type)}&tb=${encodeURIComponent(cardB.type)}`);
    await load(cardA.entity_id, cardB.entity_id, cardA.type, cardB.type);
  }

  async function load(idA: string, idB: string, ta?: string, tb?: string) {
    setPair({ state: "loading" });
    try {
      const res = await fetch(`/api/pair?a=${idA}&b=${idB}${ta ? `&ta=${encodeURIComponent(ta)}` : ""}${tb ? `&tb=${encodeURIComponent(tb)}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't check this pairing");
      setPair({ state: "ready", data });
      setA((s) => ({ ...s, state: "picked", card: data.a, query: s.query || data.a.name }));
      setB((s) => ({ ...s, state: "picked", card: data.b, query: s.query || data.b.name }));
    } catch (err) {
      setPair({ state: "error", message: (err as Error).message });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!a.query.trim() || !b.query.trim()) return;
    setPair({ state: "idle" });
    setA((s) => ({ ...s, state: "loading" }));
    setB((s) => ({ ...s, state: "loading" }));
    const [ra, rb] = await Promise.all([resolveName(a.query.trim()), resolveName(b.query.trim())]);
    setA(ra);
    setB(rb);
    if (ra.card && rb.card) check(ra.card, rb.card);
  }

  function choose(side: "a" | "b", card: Card) {
    const next = { ...(side === "a" ? a : b), state: "picked" as const, card };
    if (side === "a") setA(next);
    else setB(next);
    const other = side === "a" ? b.card : a.card;
    if (other && (side === "a" ? b.state : a.state) === "picked") check(side === "a" ? card : other, side === "a" ? other : card);
  }

  useEffect(() => {
    if (initial) load(initial.a, initial.b, initial.ta, initial.tb);
  }, [initial?.a, initial?.b]); // eslint-disable-line react-hooks/exhaustive-deps -- once per shared link

  const p = pair.data;
  const partner: Pick | null = p ? { entity_id: p.b.entity_id, name: p.b.name, type: p.b.type, affinity: p.bAmongA.affinity ?? 0, popularity: p.b.popularity, image: p.b.image, short_description: p.b.short_description, tags: p.bAmongA.tags.slice(0, 5) } : null;

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-10 sm:py-14">
      <header className="mb-6">
        <Link href="/" className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Crossover
        </Link>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Check a pairing</h1>
        <p className="mt-1 text-zinc-600">Two names in: does each audience like the other, where do they overlap, and what kind of collab is it?</p>
      </header>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
        <NameInput label="First" side={a} onChange={(q) => setA({ query: q, state: "idle" })} />
        <span className="hidden pb-3 text-center text-2xl text-zinc-400 sm:block">&times;</span>
        <NameInput label="Second" side={b} onChange={(q) => setB({ query: q, state: "idle" })} />
        <button className="rounded-xl bg-zinc-900 px-5 py-3 text-white disabled:opacity-50" disabled={!a.query.trim() || !b.query.trim()}>
          Check
        </button>
      </form>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SideStatus side={a} onChoose={(c) => choose("a", c)} />
        <SideStatus side={b} onChoose={(c) => choose("b", c)} />
      </div>

      {pair.state === "loading" && <p className="mt-8 animate-pulse text-zinc-500">Checking both audiences in Qloo and writing the verdict...</p>}
      {pair.state === "error" && <p className="mt-8 rounded-lg bg-red-50 p-3 text-red-800">{pair.message}</p>}

      {p && pair.state === "ready" && (
        <div className="mt-8 space-y-8">
          <section className="rounded-xl border border-zinc-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
              {KIND[p.kind]}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-900">{p.verdict}</p>
            <button onClick={() => setBrief(true)} className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: ACCENT }}>
              Write the full brief
            </button>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <RankBar label={`${p.b.name} among ${p.a.name} fans`} d={p.bAmongA} kind={TYPE[p.b.type] ?? "entities"} />
            <RankBar label={`${p.a.name} among ${p.b.name} fans`} d={p.aAmongB} kind={TYPE[p.a.type] ?? "entities"} />
          </section>

          <section className="grid items-start gap-6 md:grid-cols-[3fr_2fr]">
            <UsMap
              cells={p.cells}
              metros={p.overlap.map((o): City => ({ name: o.market, lat: o.lat, lon: o.lon, score: 0, overIndex: o.combined, cells: 0 }))}
              hovered={null}
            />
            <div>
              <h2 className="mb-1 text-lg font-semibold">Where both run hot</h2>
              <p className="mb-3 text-sm text-zinc-500">
                Markets in both top tens. Over-index vs. the US average (100 = average): {p.a.name} / {p.b.name}
              </p>
              {p.overlap.length ? (
                <ol className="divide-y divide-zinc-100">
                  {p.overlap.map((o, i) => (
                    <li key={o.market} className={`flex items-center gap-3 py-2 ${i < 3 ? "font-semibold" : "text-zinc-700"}`}>
                      <span className="w-7 text-sm text-zinc-400">{i + 1}</span>
                      <span className="flex-1">{o.market}</span>
                      <span className="text-sm tabular-nums">
                        {o.seed_over_index} / {o.partner_over_index}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-zinc-500">No market is in both top tens.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Shared taste</h2>
            {p.sharedTags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {p.sharedTags.map((t) => (
                  <span key={t} className="rounded bg-zinc-100 px-2 py-1 text-sm text-zinc-700">
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No Qloo tags in common.</p>
            )}
          </section>
        </div>
      )}

      {brief && p && partner && (
        <BriefPanel
          seed={p.a}
          proxy={null}
          basedOn={[]}
          pick={partner}
          domain={p.b.type.replace("urn:entity:", "")}
          onDecide={() => {}}
          onClose={closeBrief}
        />
      )}
    </main>
  );
}

function NameInput({ label, side, onChange }: { label: string; side: Side; onChange: (q: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      <input
        value={side.query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="A brand, artist, show, or person"
        className="rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-zinc-900"
        maxLength={100}
      />
    </label>
  );
}

function SideStatus({ side, onChoose }: { side: Side; onChoose: (c: Card) => void }) {
  if (side.state === "loading") return <p className="text-sm text-zinc-500">Looking for &ldquo;{side.query}&rdquo;...</p>;
  if (side.state === "error") return <p className="text-sm text-red-700">{side.message}</p>;
  if (side.state === "not_found")
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-600">
        Qloo doesn&apos;t know &ldquo;{side.query}&rdquo;. Pairing needs two names Qloo knows; for a brand it doesn&apos;t, build a slate from stand-in brands in{" "}
        <Link href="/" className="underline">
          the main flow
        </Link>
        .
      </p>
    );
  if (side.state === "ambiguous")
    return (
      <div>
        <p className="mb-2 text-sm text-zinc-600">Which &ldquo;{side.query}&rdquo;?</p>
        <div className="grid gap-2">
          {side.candidates!.map((c) => (
            <button key={c.entity_id} onClick={() => onChoose(c)} className="text-left">
              <SmallCard card={c} />
            </button>
          ))}
        </div>
      </div>
    );
  if (side.card) return <SmallCard card={side.card} />;
  return null;
}

function SmallCard({ card }: { card: Card }) {
  return (
    <div className="flex gap-3 rounded-xl border border-zinc-200 p-3">
      {card.image ? <img src={card.image} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-zinc-100 object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-lg bg-zinc-100" />}
      <div className="min-w-0">
        <p className="truncate font-semibold">{card.name}</p>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{TYPE[card.type] ?? "Entity"}</p>
        {card.short_description && <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600">{card.short_description}</p>}
      </div>
    </div>
  );
}

// Rank bar: full at #1, empty outside the top 50, with the top-10 zone marked.
function RankBar({ label, d, kind }: { label: string; d: Direction; kind: string }) {
  const width = d.rank ? ((51 - d.rank) / 50) * 100 : 0;
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{d.rank ? `#${d.rank}` : "Outside top 50"}</p>
      <div className="relative mt-2 h-2 rounded bg-zinc-100">
        <div className="absolute inset-y-0 right-0 border-l border-dashed border-zinc-400" style={{ left: "80%" }} title="top 10" />
        <div className="h-2 rounded" style={{ width: `${width}%`, background: ACCENT }} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Among their fans&apos; top 50 {kind.toLowerCase()}s. Affinity {d.affinity?.toFixed(2) ?? "n/a"}; top-10 cutoff {d.top10Cutoff?.toFixed(2) ?? "n/a"}, top-50 cutoff {d.top50Cutoff?.toFixed(2) ?? "n/a"}.
      </p>
    </div>
  );
}
