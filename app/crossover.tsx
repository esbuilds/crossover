"use client";
/* eslint-disable @next/next/no-img-element -- Qloo images are remote and already sized; next/image adds config for nothing in v1 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Card, Domain, Pick } from "@/lib/slate.ts";
import type { Cities } from "@/lib/cities.ts";
import type { Ranking } from "@/lib/agent/rank.ts";
import { formatProxies, weightsFor } from "@/lib/proxy-params.ts";
import { playbookFor } from "@/lib/playbook.ts";
import UsMap, { ACCENT } from "./map";
import BriefPanel, { type Decision } from "./brief-panel";
import ProxyForm, { BasedOn, type ProxyDraft } from "./proxy-form";

type ResolveResult = { status: "confident" | "ambiguous" | "not_found"; candidates: Card[] };
type SlateData = { entity: Card; basedOn: Card[]; domains: { domain: Domain; picks: Pick[] }[]; cities: Cities };
// proxy mode: a brand Qloo doesn't know, its description, and weighted stand-ins ("id:10,id:5")
export type ProxySpec = { name: string; d: string; p: string; t?: string };
const proxyQuery = (s: ProxySpec) => new URLSearchParams({ name: s.name, d: s.d, p: s.p, ...(s.t ? { t: s.t } : {}) }).toString();
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
  proxy: "Brand, not in Qloo yet",
};
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export default function Crossover({ initialId, initialProxy }: { initialId?: string; initialProxy?: ProxySpec }) {
  const [query, setQuery] = useState("");
  const [resolved, setResolved] = useState<Load<ResolveResult>>({ state: "idle" });
  const [entity, setEntity] = useState<Card | null>(null);
  const [alternates, setAlternates] = useState<Card[]>([]);
  const [slate, setSlate] = useState<Load<SlateData>>({ state: "idle" });
  const [trace, setTrace] = useState<string[]>([]);
  const [ranking, setRanking] = useState<Partial<Ranking>>({});
  const [proxy, setProxy] = useState<ProxySpec | null>(null); // the proxy run on screen, if any
  const [draft, setDraft] = useState<ProxyDraft | null>(null); // the proxy form, when it's showing
  const [running, setRunning] = useState(false); // the run stream is still open (ranking may still arrive)
  const [open, setOpen] = useState<{ pick: Pick; domain: Domain } | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({}); // approve/decline per pick, this browser only
  const source = useRef<EventSource | null>(null); // newest run wins; starting another closes this one
  const closeBrief = useCallback(() => setOpen(null), []);

  function stop() {
    source.current?.close();
    source.current = null;
    setRunning(false);
  }

  // Real trace: /api/run streams each Qloo step as it lands, the slate as soon as retrieval is done, then the
  // ranking one domain at a time.
  function loadSlate(id: string, name?: string, type?: string) {
    setProxy(null);
    startRun(`/api/run?entity=${id}${type ? `&type=${encodeURIComponent(type)}` : ""}`, !name);
  }

  function loadProxy(spec: ProxySpec) {
    setProxy(spec);
    setEntity(null);
    setDraft(null);
    setResolved({ state: "idle" });
    startRun(`/api/run?${proxyQuery(spec)}`, true);
  }

  function startRun(url: string, takeEntity: boolean) {
    stop();
    setSlate({ state: "loading" });
    setRanking({});
    setOpen(null);
    setTrace([]);
    setRunning(true);
    const es = new EventSource(url);
    source.current = es;
    const fail = (message: string) => {
      stop();
      setSlate((s) => (s.state === "ready" ? s : { state: "error", message })); // keep a slate that already arrived
    };
    es.onmessage = (m) => {
      if (source.current !== es) return;
      const ev = JSON.parse(m.data);
      if (ev.type === "trace") setTrace((t) => [...t, ev.text]);
      else if (ev.type === "slate") {
        if (takeEntity) setEntity(ev.data.entity);
        setSlate({ state: "ready", data: ev.data });
        setDecisions(loadDecisions(decisionKey(ev.data.entity, url)));
      } else if (ev.type === "ranking") setRanking((r) => ({ ...r, [ev.domain]: ev.data }));
      else if (ev.type === "done") stop();
      else if (ev.type === "error") fail(ev.message);
    };
    es.onerror = () => source.current === es && fail("Lost the connection while building the slate");
  }

  function choose(card: Card, others: Card[] = []) {
    setEntity(card);
    setAlternates(others);
    setResolved({ state: "idle" });
    setDraft(null);
    window.history.pushState(null, "", `/s/${card.entity_id}`);
    loadSlate(card.entity_id, card.name, card.type);
  }

  async function lookup(q: string) {
    q = q.trim();
    if (!q) return;
    setQuery(q);
    stop(); // cancel any run in flight
    window.history.pushState(null, "", "/"); // the old /s/<id> no longer describes the page
    setEntity(null);
    setProxy(null);
    setDraft(null);
    setSlate({ state: "idle" });
    setTrace([]);
    setResolved({ state: "loading" });
    try {
      const r = await getJson<ResolveResult>(`/api/resolve?q=${encodeURIComponent(q)}`);
      if (r.status === "confident") choose(r.candidates[0], r.candidates.slice(1));
      else {
        setResolved({ state: "ready", data: r });
        setDraft({ name: q, description: "", brands: [] });
      }
    } catch (err) {
      setResolved({ state: "error", message: (err as Error).message });
    }
  }

  function notIt() {
    stop();
    setEntity(null);
    setSlate({ state: "idle" });
    setTrace([]);
    setResolved({ state: "ready", data: { status: alternates.length ? "ambiguous" : "not_found", candidates: alternates } });
    setDraft({ name: entity?.name ?? query, description: "", brands: [] });
    window.history.pushState(null, "", "/");
  }

  function buildFromProxies(d: ProxyDraft, proxies: Card[], tag?: string) {
    const spec = { name: d.name.trim(), d: d.description.trim(), p: formatProxies(weightsFor(proxies.map((p) => p.entity_id))), t: tag };
    window.history.pushState(null, "", `/s/p?${proxyQuery(spec)}`);
    loadProxy(spec);
  }

  // "Edit" on the banner: back to the form with everything prefilled.
  function editProxies(basedOn: Card[]) {
    if (!proxy) return;
    stop();
    setEntity(null); // the proxy card belongs to the run being edited
    setDraft({ name: proxy.name, description: proxy.d, brands: basedOn.map((c) => c.name) });
    setSlate({ state: "idle" });
    setTrace([]);
    setResolved({ state: "idle" });
    window.history.pushState(null, "", "/");
  }

  // A shared /s/<id> link starts straight at the slate. loadSlate sets loading state up front, which is the point here.
  useEffect(() => {
    if (initialId) loadSlate(initialId); // eslint-disable-line react-hooks/set-state-in-effect
    else if (initialProxy) loadProxy(initialProxy);
  }, [initialId, initialProxy?.p]); // eslint-disable-line react-hooks/exhaustive-deps -- run once per shared link, not per render

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
        {draft && (
          <ProxyForm
            key={`${draft.name}|${draft.brands.join("|")}`}
            draft={draft}
            compact={resolved.state === "ready" && resolved.data.status === "ambiguous"}
            onBuild={buildFromProxies}
          />
        )}
        {entity && <MatchCard card={entity} onNotIt={entity.type === "proxy" ? undefined : notIt} />}
        {proxy && slate.state === "ready" && <BasedOn cards={slate.data.basedOn} onEdit={() => editProxies(slate.data.basedOn)} />}
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
      {slate.state === "ready" && <Results data={slate.data} ranking={ranking} running={running} decisions={decisions} onOpen={(pick, domain) => setOpen({ pick, domain })} />}
      {open && slate.state === "ready" && (
        <BriefPanel
          key={open.pick.entity_id}
          seed={slate.data.entity}
          proxy={proxy}
          basedOn={slate.data.basedOn}
          pick={open.pick}
          domain={open.domain}
          decision={decisions[open.pick.entity_id]}
          onDecide={(d) => {
            const next = { ...decisions, [open.pick.entity_id]: d };
            setDecisions(next);
            saveDecisions(decisionKey(slate.data.entity, proxy ? `/api/run?${proxyQuery(proxy)}` : ""), next);
          }}
          onClose={closeBrief}
        />
      )}
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

// With a ranking: the shortlist first (with why-lines), then picks the agent neither kept nor dropped,
// dropped picks hidden behind a toggle. Without one: Qloo's order.
// Picks you declined join the dropped list with your reason.
function arrange(picks: Pick[], r: Ranking[Domain] | undefined, decisions: Record<string, Decision>) {
  const declined = picks.filter((p) => decisions[p.entity_id]?.status === "declined");
  const mine = declined.map((p) => ({ entity_id: p.entity_id, name: p.name, reason: `You declined: ${decisions[p.entity_id].reason}` }));
  const live = picks.filter((p) => !declined.includes(p));
  if (!r) return { rows: live.map((pick) => ({ pick, why: undefined as string | undefined, demoted: undefined as string | undefined })), dropped: mine };
  const byId = new Map(live.map((p) => [p.entity_id, p]));
  const row = (k: { entity_id: string; why: string; demoted?: string }) =>
    byId.has(k.entity_id) ? [{ pick: byId.get(k.entity_id)!, why: (k.why || undefined) as string | undefined, demoted: k.demoted }] : [];
  const demoted = r.demoted ?? []; // rankings cached before rank-v3 have no demoted list
  const used = new Set([...r.kept, ...demoted, ...r.dropped].map((d) => d.entity_id));
  return {
    rows: [...r.kept.flatMap(row), ...live.filter((p) => !used.has(p.entity_id)).map((pick) => ({ pick, why: undefined, demoted: undefined })), ...demoted.flatMap(row)],
    dropped: [...mine, ...r.dropped.filter((d) => !decisions[d.entity_id])],
  };
}

// Approve/decline decisions live in localStorage per entity (or per proxy set). Nothing leaves the browser.
const decisionKey = (entity: Card, runUrl: string) => `crossover:decisions:${entity.entity_id === "proxy" ? runUrl : entity.entity_id}`;
function loadDecisions(key: string): Record<string, Decision> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {}; // private mode or blocked storage: decisions just don't persist
  }
}
function saveDecisions(key: string, d: Record<string, Decision>) {
  try {
    localStorage.setItem(key, JSON.stringify(d));
  } catch {}
}

function Results({
  data,
  ranking,
  running,
  decisions,
  onOpen,
}: {
  data: SlateData;
  ranking: Partial<Ranking>;
  running: boolean;
  decisions: Record<string, Decision>;
  onOpen: (pick: Pick, domain: Domain) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  // "driven by" chips (proxy mode): only on picks a stand-in other than the top one drove; none if they all agree
  const proxyNames = new Map(data.basedOn.map((c) => [c.entity_id, c.name]));
  const top = data.basedOn[0]?.entity_id;
  const anyOther = data.domains.some((d) => d.picks.some((p) => p.driven_by && p.driven_by !== top));
  const chipFor = (p: Pick) => (anyOther && p.driven_by && p.driven_by !== top ? proxyNames.get(p.driven_by) : undefined);
  const top5 = data.cities.metros.slice(0, 5);
  const even = top5.length === 5 && top5[0].overIndex - top5[4].overIndex < 3;
  return (
    <div className="mt-8 space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Partners for {data.entity.name}</h2>
        <p className="mt-0.5 text-sm text-zinc-500">{playbookFor(data.entity.type).slateSubtitle}</p>
      </div>
      {data.domains.map(({ domain, picks }) => {
        const { rows, dropped } = arrange(picks, ranking[domain], decisions);
        return (
          <section key={domain}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold">
                {DOMAIN_LABEL[domain]}
                {running && !ranking[domain] && <span className="ml-3 animate-pulse text-sm font-normal text-zinc-400">Claude is shortlisting...</span>}
              </h2>
              {dropped.length > 0 && (
                <details className="relative text-sm text-zinc-500">
                  <summary className="cursor-pointer select-none hover:text-zinc-900">{dropped.length} dropped</summary>
                  <ul className="absolute right-0 z-10 mt-1 w-72 space-y-1.5 rounded-lg border border-zinc-200 bg-white p-3 text-zinc-700 shadow-lg">
                    {dropped.map((d) => (
                      <li key={d.entity_id}>
                        <span className="font-medium">{d.name}</span>: {d.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            {rows.length ? (
              <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-2">
                {rows.map(({ pick, why, demoted }) => (
                  <PickCard
                    key={pick.entity_id}
                    pick={pick}
                    why={why}
                    demoted={demoted}
                    drivenBy={chipFor(pick)}
                    approved={decisions[pick.entity_id]?.status === "approved"}
                    onOpen={() => onOpen(pick, domain)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Nothing here for this audience.</p>
            )}
          </section>
        );
      })}

      <section className="grid items-start gap-6 md:grid-cols-[3fr_2fr]">
        <UsMap cells={data.cities.cells} metros={data.cities.metros} hovered={hovered} />
        <div>
          <h2 className="mb-1 text-lg font-semibold">Where to launch</h2>
          <p className="mb-3 text-sm text-zinc-500">Over-index vs. the US average (100 = average)</p>
          {even && <p className="mb-3 rounded-lg bg-zinc-50 p-2.5 text-sm text-zinc-600">Fans are spread evenly across these markets, so any of the top five is a fair place to start.</p>}
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

function PickCard({
  pick,
  why,
  demoted,
  drivenBy,
  approved,
  onOpen,
}: {
  pick: Pick;
  why?: string;
  demoted?: string;
  drivenBy?: string;
  approved?: boolean;
  onOpen: () => void;
}) {
  return (
    <button onClick={onOpen} className="flex w-40 shrink-0 flex-col rounded-lg text-left outline-offset-4 hover:opacity-90 sm:w-44">
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
      {approved && <p className="mt-1.5 inline-block self-start rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">Approved</p>}
      {drivenBy && <p className="mt-1.5 text-[11px] text-orange-800">driven by {drivenBy}</p>}
      {why && <p className="mt-2 text-[13px] leading-snug text-zinc-700">{why}</p>}
      {demoted && <p className="mt-1 text-[12px] leading-snug text-zinc-500">Ranked lower: {demoted}</p>}
    </button>
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
