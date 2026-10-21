"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Card, Pick } from "@/lib/slate.ts";
import type { Pair } from "@/lib/pairing.ts";
import type { Direction } from "@/lib/fit.ts";
import type { City } from "@/lib/cities.ts";
import UsMap from "../map";
import BriefPanel, { Skeleton } from "../brief-panel";
import { btnPrimary, btnSecondary, btnText, Chip, type ChipKind, ExampleLinks, field, MatchCard, SiteHeader, TYPE_LABEL, shell } from "../ui";

type Side = { query: string; state: "idle" | "loading" | "picked" | "ambiguous" | "not_found" | "error"; card?: Card; candidates?: Card[]; message?: string };
const empty: Side = { query: "", state: "idle" };
const KIND: Record<Pair["kind"], { label: string; chip: ChipKind }> = {
  affinity: { label: "Affinity play", chip: "mutual" },
  "one-way": { label: "Ranked by one side only", chip: "oneway" },
  contrast: { label: "Contrast play", chip: "note" },
};

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
  const [pair, setPair] = useState<{ state: "idle" | "loading" | "ready" | "error"; data?: Pair; message?: string; code?: string }>({ state: initial ? "loading" : "idle" });
  const [brief, setBrief] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeBrief = useCallback(() => setBrief(false), []);

  async function check(cardA: Card, cardB: Card, push = true) {
    if (push) window.history.pushState(null, "", `/pair/${cardA.entity_id}/${cardB.entity_id}?ta=${encodeURIComponent(cardA.type)}&tb=${encodeURIComponent(cardB.type)}`);
    await load(cardA.entity_id, cardB.entity_id, cardA.type, cardB.type);
  }

  async function load(idA: string, idB: string, ta?: string, tb?: string) {
    setPair({ state: "loading" });
    setCopied(false);
    try {
      const res = await fetch(`/api/pair?a=${idA}&b=${idB}${ta ? `&ta=${encodeURIComponent(ta)}` : ""}${tb ? `&tb=${encodeURIComponent(tb)}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error(data.error ?? "Couldn't check this pairing"), { code: data.code });
      setPair({ state: "ready", data });
      setA((s) => ({ ...s, state: "picked", card: data.a, query: s.query || data.a.name }));
      setB((s) => ({ ...s, state: "picked", card: data.b, query: s.query || data.b.name }));
    } catch (err) {
      setPair({ state: "error", message: (err as Error).message, code: (err as { code?: string }).code });
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
  const partner: Pick | null = p ? { entity_id: p.b.entity_id, name: p.b.name, type: p.b.type, affinity: p.bAmongA.affinity ?? 0, popularity: p.b.popularity, short_description: p.b.short_description, tags: p.bAmongA.tags.slice(0, 5) } : null;
  const ready = p && pair.state === "ready";

  return (
    <main className={shell}>
      <SiteHeader href="/find" label="Find partners" />

      <section className="pt-page">
        <h1 className="font-display text-2xl sm:text-3xl">Check a pairing</h1>
        <p className="mt-2 max-w-[60ch] text-base text-ink-2">Two names in: does each audience like the other, where do they overlap, and what kind of collab is it?</p>
        <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
          <NameInput label="First" side={a} onChange={(q) => setA({ query: q, state: "idle" })} />
          <span aria-hidden className="hidden pb-2 text-center font-display text-2xl text-ink-3 sm:block">
            &times;
          </span>
          <NameInput label="Second" side={b} onChange={(q) => setB({ query: q, state: "idle" })} />
          <button className={ready ? btnSecondary : btnPrimary} disabled={!a.query.trim() || !b.query.trim()}>
            Check
          </button>
        </form>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SideStatus side={a} onChoose={(c) => choose("a", c)} />
        <SideStatus side={b} onChoose={(c) => choose("b", c)} />
      </div>

      {pair.state === "loading" && (
        <div aria-live="polite">
          <p className="mt-10 font-mono text-sm text-ink-3 motion-safe:animate-pulse">Checking both audiences in Qloo and writing the verdict...</p>
          <Skeleton lines={4} />
        </div>
      )}
      {pair.state === "error" &&
        (pair.code ? (
          <div className="mt-8 rounded-md bg-surface-2 px-4 py-3 text-base text-ink">
            <p>{pair.message}</p>
            <ExampleLinks />
          </div>
        ) : (
          <p className="mt-8 rounded-md bg-danger-tint px-4 py-3 text-base text-danger">{pair.message}</p>
        ))}

      {p && ready && (
        <div className="mt-10">
          <section className="border-b border-ink pb-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Chip kind={KIND[p.kind].chip}>{KIND[p.kind].label}</Chip>
              <button onClick={() => navigator.clipboard.writeText(window.location.href).then(() => setCopied(true))} className={`${btnText} text-sm`}>
                {copied ? "Link copied" : "Copy link to this pairing"}
              </button>
            </div>
            <p className="mt-3 max-w-[60ch] font-display text-xl text-pretty">{p.verdict}</p>
            <button onClick={() => setBrief(true)} className={`${btnPrimary} mt-6`}>
              Write the full brief
            </button>
          </section>

          <section className="grid gap-x-10 border-b border-rule sm:grid-cols-2">
            <RankBar who={p.b.name} among={p.a.name} d={p.bAmongA} kind={TYPE_LABEL[p.b.type] ?? "entity"} />
            <RankBar who={p.a.name} among={p.b.name} d={p.aAmongB} kind={TYPE_LABEL[p.a.type] ?? "entity"} />
          </section>

          <section className="border-b border-rule py-10">
            <h2 className="font-display text-xl">Where both run hot</h2>
            <p className="mt-1 text-base text-ink-2">Markets in both top tens, over-index against the US average (100 is average).</p>
            <div className="mt-6 grid items-start gap-8 md:grid-cols-[3fr_2fr]">
              <UsMap
                cells={p.cells}
                metros={p.overlap.map((o): City => ({ name: o.market, lat: o.lat, lon: o.lon, score: 0, overIndex: o.combined, cells: 0 }))}
                hovered={null}
              />
              {p.overlap.length ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-sm text-ink-3">
                      <th className="w-6 pb-2 font-normal" />
                      <th className="pb-2 font-normal">Market</th>
                      <th className="max-w-[9ch] truncate pb-2 text-right font-normal">{p.a.name}</th>
                      <th className="max-w-[9ch] truncate pb-2 pl-3 text-right font-normal">{p.b.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.overlap.map((o, i) => (
                      <tr key={o.market} className={`border-t border-rule ${i < 3 ? "text-lg font-semibold" : "text-base text-ink-2"}`}>
                        <td className="py-2.5 pr-3 text-right font-mono text-sm font-normal text-ink-3 tabular-nums">{i + 1}</td>
                        <td className="py-2.5">{o.market}</td>
                        <td className="py-2.5 text-right tabular-nums">{o.seed_over_index}</td>
                        <td className="py-2.5 pl-3 text-right tabular-nums">{o.partner_over_index}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-base text-ink-2">No market is in both top tens, so there is no shared launch city to point to.</p>
              )}
            </div>
          </section>

          <section className="py-10">
            <h2 className="font-display text-xl">Shared taste</h2>
            {p.sharedTags.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {p.sharedTags.map((t) => (
                  <span key={t} className="rounded-sm border border-rule px-2.5 py-1 text-sm text-ink-2">
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-base text-ink-2">The two carry no Qloo tags in common.</p>
            )}
          </section>
        </div>
      )}

      {brief && p && partner && (
        <BriefPanel seed={p.a} proxy={null} basedOn={[]} pick={partner} domain={p.b.type.replace("urn:entity:", "")} onDecide={() => {}} onClose={closeBrief} />
      )}
    </main>
  );
}

function NameInput({ label, side, onChange }: { label: string; side: Side; onChange: (q: string) => void }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input value={side.query} onChange={(e) => onChange(e.target.value)} placeholder="A brand, artist, show, or person" className={field} maxLength={100} />
    </label>
  );
}

function SideStatus({ side, onChoose }: { side: Side; onChoose: (c: Card) => void }) {
  if (side.state === "loading") return <p className="font-mono text-sm text-ink-3">Looking for &ldquo;{side.query}&rdquo;...</p>;
  if (side.state === "error") return <p className="rounded-md bg-danger-tint px-4 py-3 text-base text-danger">{side.message}</p>;
  if (side.state === "not_found")
    return (
      <p className="rounded-lg border border-rule px-4 py-3 text-base text-ink-2">
        Qloo doesn&apos;t know &ldquo;{side.query}&rdquo;. Pairing needs two names Qloo knows. For a brand it doesn&apos;t, build a slate from stand-in brands{" "}
        <Link href="/find" className="underline underline-offset-4">
          on the search page
        </Link>
        .
      </p>
    );
  if (side.state === "ambiguous")
    return (
      <div>
        <p className="mb-2 text-base text-ink-2">Which &ldquo;{side.query}&rdquo;?</p>
        <div className="grid gap-2">
          {side.candidates!.map((c) => (
            <button key={c.entity_id} onClick={() => onChoose(c)} className="rounded-lg text-left hover:[&>div]:border-ink">
              <MatchCard card={c} />
            </button>
          ))}
        </div>
      </div>
    );
  if (side.card) return <MatchCard card={side.card} />;
  return null;
}

// Rank bar: full at #1, empty outside the top 50. The top-10 zone is shaded and labeled, and the result is in words.
function RankBar({ who, among, d, kind }: { who: string; among: string; d: Direction; kind: string }) {
  const width = d.rank ? ((51 - d.rank) / 50) * 100 : 0;
  const words = !d.rank ? "Outside their top 50" : d.rank <= 10 ? "In their top 10" : "In their top 50";
  return (
    <div className="py-8">
      <p className="text-base text-ink-2">
        {who} among {among} fans
      </p>
      <p className="mt-1 flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">{d.rank ? `#${d.rank}` : "Not ranked"}</span>
        <span className="text-base text-ink">{words}</span>
      </p>
      <div className="relative mt-3 h-2 rounded-full bg-rule">
        <div className="absolute inset-y-0 right-0 left-[80%] rounded-r-full bg-rule-strong" />
        <div className="relative h-2 rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-ink-3">
        <span>#50</span>
        <span>Top 10</span>
      </div>
      <p className="mt-3 text-sm text-ink-2 tabular-nums">
        Among their fans&apos; top 50 {kind.toLowerCase()}s. Affinity {d.affinity?.toFixed(2) ?? "n/a"}; top-10 cutoff {d.top10Cutoff?.toFixed(2) ?? "n/a"}, top-50 cutoff{" "}
        {d.top50Cutoff?.toFixed(2) ?? "n/a"}.
      </p>
    </div>
  );
}
