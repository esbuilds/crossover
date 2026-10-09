"use client";
/* eslint-disable @next/next/no-img-element -- Qloo images are remote and already sized; next/image adds config for nothing in v1 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Card, Domain, Pick } from "@/lib/slate.ts";
import type { Cities } from "@/lib/cities.ts";
import UsMap, { ACCENT } from "./map";

type ResolveResult = { status: "confident" | "ambiguous" | "not_found"; candidates: Card[] };
type SlateData = { entity: Card; domains: { domain: Domain; picks: Pick[] }[]; cities: Cities };
type Load<T> = { state: "idle" } | { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

const CHIPS = ["Liquid Death", "Olipop", "Mt. Joy", "Somebody Feed Phil"];
const DOMAIN_LABEL: Record<Domain, string> = {
  brand: "Brands",
  artist: "Artists",
  tv_show: "TV shows",
  movie: "Films",
  podcast: "Podcasts",
  place: "Places",
};
const TYPE_LABEL: Record<string, string> = {
  "urn:entity:brand": "Brand",
  "urn:entity:artist": "Artist",
  "urn:entity:tv_show": "TV show",
  "urn:entity:movie": "Film",
  "urn:entity:person": "Person",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export default function Crossover({ initialId }: { initialId?: string }) {
  const [query, setQuery] = useState("");
  const [resolved, setResolved] = useState<Load<ResolveResult>>({ state: "idle" });
  const [entity, setEntity] = useState<Card | null>(null);
  const [alternates, setAlternates] = useState<Card[]>([]);
  const [slate, setSlate] = useState<Load<SlateData>>({ state: "idle" });
  const [trace, setTrace] = useState<string[]>([]);
  const run = useRef(0); // newest request wins; older ones bail out after each await

  // v1 fakes the trace timing client-side; the real streamed trace comes with the agent on Oct 13.
  async function loadSlate(id: string, name?: string, type?: string) {
    const token = ++run.current;
    const stale = () => token !== run.current;
    setSlate({ state: "loading" });
    setTrace(name ? [`Found ${name} in Qloo`] : ["Opening shared slate"]);
    const req = getJson<SlateData>(`/api/slate?entity=${id}${type ? `&type=${type}` : ""}`);
    req.catch(() => {}); // handled below; avoids an unhandled rejection while the trace animates

    await sleep(450);
    if (stale()) return;
    setTrace((t) => [...t, "Pulling fans' top artists, brands, shows, films, places, podcasts"]);
    try {
      const [data] = await Promise.all([req, sleep(500)]);
      if (stale()) return;
      if (!name) setEntity(data.entity);
      setTrace((t) => [...t, `Ranking ${data.cities.marketCount} US markets from ${data.cities.cellCount.toLocaleString()} heatmap cells`]);
      await sleep(450);
      if (stale()) return;
      setSlate({ state: "ready", data });
    } catch (err) {
      if (!stale()) setSlate({ state: "error", message: (err as Error).message });
    }
  }

  function choose(card: Card, others: Card[] = []) {
    setEntity(card);
    setAlternates(others);
    setResolved({ state: "idle" });
    window.history.pushState(null, "", `/s/${card.entity_id}`);
    loadSlate(card.entity_id, card.name, card.type);
  }

  async function lookup(q: string) {
    q = q.trim();
    if (!q) return;
    setQuery(q);
    run.current++; // cancel any slate in flight
    setEntity(null);
    setSlate({ state: "idle" });
    setTrace([]);
    setResolved({ state: "loading" });
    try {
      const r = await getJson<ResolveResult>(`/api/resolve?q=${encodeURIComponent(q)}`);
      if (r.status === "confident") choose(r.candidates[0], r.candidates.slice(1));
      else setResolved({ state: "ready", data: r });
    } catch (err) {
      setResolved({ state: "error", message: (err as Error).message });
    }
  }

  function notIt() {
    run.current++;
    setEntity(null);
    setSlate({ state: "idle" });
    setTrace([]);
    setResolved({ state: "ready", data: { status: alternates.length ? "ambiguous" : "not_found", candidates: alternates } });
    window.history.pushState(null, "", "/");
  }

  // A shared /s/<id> link starts straight at the slate. loadSlate sets loading state up front, which is the point here.
  useEffect(() => {
    if (initialId) loadSlate(initialId); // eslint-disable-line react-hooks/set-state-in-effect
  }, [initialId]);

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-10 sm:py-14">
      <header className="mb-6">
        <Link href="/" className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Crossover
        </Link>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Who should you collab with, and where?</h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="A brand, artist, show, or person"
          aria-label="A brand, artist, show, or person"
          className="w-full rounded-xl border border-zinc-300 px-5 py-4 text-lg outline-none focus:border-zinc-900"
        />
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button key={c} onClick={() => lookup(c)} className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:border-zinc-900">
            {c}
          </button>
        ))}
      </div>

      <section className="mt-6">
        {resolved.state === "loading" && <p className="text-zinc-500">Looking for &ldquo;{query}&rdquo; in Qloo...</p>}
        {resolved.state === "error" && <p className="text-red-700">Couldn&apos;t search Qloo: {resolved.message}</p>}
        {resolved.state === "ready" && resolved.data.status === "ambiguous" && (
          <div>
            <p className="mb-3 text-zinc-600">Which one did you mean?</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {resolved.data.candidates.map((c) => (
                <button key={c.entity_id} onClick={() => choose(c)} className="text-left">
                  <MatchCard card={c} />
                </button>
              ))}
            </div>
          </div>
        )}
        {resolved.state === "ready" && (resolved.data.status === "not_found" || resolved.data.status === "ambiguous") && (
          <NotFound name={query} compact={resolved.data.status === "ambiguous"} />
        )}
        {entity && <MatchCard card={entity} onNotIt={notIt} />}
      </section>

      {trace.length > 0 && (
        <ol className="mt-6 space-y-1 text-sm text-zinc-600">
          {trace.map((line) => (
            <li key={line}>&rarr; {line}</li>
          ))}
        </ol>
      )}

      {slate.state === "loading" && <p className="mt-6 animate-pulse text-zinc-400">Building the slate...</p>}
      {slate.state === "error" && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          Couldn&apos;t build the slate: {slate.message}
          {entity && (
            <button onClick={() => loadSlate(entity.entity_id, entity.name, entity.type)} className="ml-3 underline">
              Try again
            </button>
          )}
        </div>
      )}
      {slate.state === "ready" && <Results data={slate.data} />}
    </main>
  );
}

function MatchCard({ card, onNotIt }: { card: Card; onNotIt?: () => void }) {
  return (
    <div className="flex gap-4 rounded-xl border border-zinc-200 p-4">
      <Thumb src={card.image} name={card.name} className="h-20 w-20 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate text-lg font-semibold">{card.name}</h2>
          {onNotIt && (
            <button onClick={onNotIt} className="shrink-0 text-sm text-zinc-500 underline hover:text-zinc-900">
              Not it
            </button>
          )}
        </div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{TYPE_LABEL[card.type] ?? "Entity"}</p>
        {card.short_description && <p className="mt-1 line-clamp-2 text-sm text-zinc-700">{card.short_description}</p>}
      </div>
    </div>
  );
}

function NotFound({ name, compact }: { name: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-dashed border-zinc-300 p-5 ${compact ? "mt-4" : ""}`}>
      <h2 className="font-semibold">{compact ? "None of these?" : "Qloo doesn't know this one yet"}</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Name two or three brands {name ? `${name}'s` : "your"} customers also love, and Crossover will build the slate from their fans.
      </p>
      <button disabled className="mt-3 cursor-not-allowed rounded-lg bg-zinc-200 px-4 py-2 text-sm text-zinc-500">
        Use proxies (coming soon)
      </button>
    </div>
  );
}

function Results({ data }: { data: SlateData }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div className="mt-8 space-y-8">
      {data.domains.map(({ domain, picks }) => (
        <section key={domain}>
          <h2 className="mb-3 text-lg font-semibold">{DOMAIN_LABEL[domain]}</h2>
          {picks.length ? (
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
              {picks.map((p) => (
                <PickCard key={p.entity_id} pick={p} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Nothing here for this audience.</p>
          )}
        </section>
      ))}

      <section className="grid items-start gap-6 md:grid-cols-[3fr_2fr]">
        <UsMap cells={data.cities.cells} metros={data.cities.metros} hovered={hovered} />
        <div>
          <h2 className="mb-1 text-lg font-semibold">Where to launch</h2>
          <p className="mb-3 text-sm text-zinc-500">Over-index vs. the US average (100 = average)</p>
          {data.cities.metros.length ? (
            <ol className="divide-y divide-zinc-100">
              {data.cities.metros.slice(0, 10).map((m, i) => (
                <li
                  key={m.name}
                  onMouseEnter={() => setHovered(m.name)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setHovered((h) => (h === m.name ? null : m.name))} // tap to highlight on touch screens
                  className={`flex cursor-default items-center gap-3 px-1 py-2 ${i < 3 ? "font-semibold" : "text-zinc-700"} ${hovered === m.name ? "bg-orange-50" : ""}`}
                >
                  <span className={`w-7 text-sm ${i < 3 ? "text-zinc-900" : "text-zinc-400"}`}>{i + 1}</span>
                  <span className="flex-1">{m.name}</span>
                  <span className={`rounded px-2 py-0.5 text-sm tabular-nums ${i < 3 ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}>{m.overIndex}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-500">Not enough heatmap data to rank US cities for this one.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function PickCard({ pick }: { pick: Pick }) {
  return (
    <div className="w-40 shrink-0 sm:w-44">
      <Thumb src={pick.image} name={pick.name} className="aspect-square w-full rounded-lg" />
      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{pick.name}</h3>
      <div className="mt-1 flex items-center gap-2" title="Affinity: how much this audience over-indexes on it">
        <div className="h-1 flex-1 rounded bg-zinc-200">
          <div className="h-1 rounded" style={{ width: `${Math.round(pick.affinity * 100)}%`, background: ACCENT }} />
        </div>
        <span className="text-xs tabular-nums text-zinc-500">{pick.affinity.toFixed(2)}</span>
      </div>
      {pick.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {[...new Set(pick.tags)].slice(0, 2).map((t) => (
            <span key={t} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ src, name, className }: { src?: string; name: string; className: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${className} shrink-0 bg-zinc-100 object-cover`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center bg-zinc-100 text-xl font-semibold text-zinc-400`}>
      {name.slice(0, 1)}
    </div>
  );
}
