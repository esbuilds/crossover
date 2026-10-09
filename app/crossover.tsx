"use client";
/* eslint-disable @next/next/no-img-element -- Qloo images are remote and already sized; next/image adds config for nothing in v1 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Card, Domain, Pick } from "@/lib/slate.ts";
import type { Cities } from "@/lib/cities.ts";
import type { Ranking } from "@/lib/agent/rank.ts";
import { formatProxies, weightsFor } from "@/lib/proxy-params.ts";
import { playbookFor } from "@/lib/playbook.ts";
import type { ConstraintSet } from "@/lib/refine.ts";
import UsMap from "./map";
import { btnPrimary, btnQuiet, btnSecondary, Chip, field, panel } from "./ui";
import BriefPanel, { type Decision } from "./brief-panel";
import ProxyForm, { BasedOn, type ProxyDraft } from "./proxy-form";

type ResolveResult = {
  status: "confident" | "ambiguous" | "not_found";
  candidates: Card[];
};
type SlateData = {
  entity: Card;
  basedOn: Card[];
  domains: { domain: Domain; picks: Pick[] }[];
  cities: Cities;
};
// proxy mode: a brand Qloo doesn't know, its description, and weighted stand-ins ("id:10,id:5")
export type ProxySpec = { name: string; d: string; p: string; t?: string; c?: string };
const proxyQuery = (s: ProxySpec) =>
  new URLSearchParams({
    name: s.name,
    d: s.d,
    p: s.p,
    ...(s.t ? { t: s.t } : {}),
  }).toString();
type Load<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; data: T };

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

export default function Crossover({
  initialId,
  initialType,
  initialConstraints,
  initialProxy,
}: {
  initialId?: string;
  initialType?: string;
  initialConstraints?: string;
  initialProxy?: ProxySpec;
}) {
  const [query, setQuery] = useState("");
  const [resolved, setResolved] = useState<Load<ResolveResult>>({
    state: "idle",
  });
  const [entity, setEntity] = useState<Card | null>(null);
  const [alternates, setAlternates] = useState<Card[]>([]);
  const [slate, setSlate] = useState<Load<SlateData>>({ state: "idle" });
  const [trace, setTrace] = useState<string[]>([]);
  const [ranking, setRanking] = useState<Partial<Ranking>>({});
  const [badges, setBadges] = useState<
    Record<string, "mutual" | "partial" | null>
  >({});
  const [proxy, setProxy] = useState<ProxySpec | null>(null); // the proxy run on screen, if any
  const [draft, setDraft] = useState<ProxyDraft | null>(null); // the proxy form, when it's showing
  const [running, setRunning] = useState(false); // the run stream is still open (ranking may still arrive)
  const [open, setOpen] = useState<{ pick: Pick; domain: Domain } | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({}); // approve/decline per pick, this browser only
  const [refineText, setRefineText] = useState(""); // the constraints sentence of the run on screen
  const [constraints, setConstraints] = useState<ConstraintSet | null>(null); // how the server read it
  const source = useRef<EventSource | null>(null); // newest run wins; starting another closes this one
  const closeBrief = useCallback(() => setOpen(null), []);

  function stop() {
    source.current?.close();
    source.current = null;
    setRunning(false);
  }

  // Real trace: /api/run streams each Qloo step as it lands, the slate as soon as retrieval is done, then the
  // ranking one domain at a time.
  // c: refine sentence ("no alcohol partners, Texas only"); same stream, re-planned retrieval.
  function loadSlate(id: string, name?: string, type?: string, c = "") {
    setProxy(null);
    setRefineText(c);
    startRun(
      `/api/run?entity=${id}${type ? `&type=${encodeURIComponent(type)}` : ""}${c ? `&c=${encodeURIComponent(c)}` : ""}`,
      !name,
    );
  }

  function loadProxy(spec: ProxySpec, c = "") {
    setProxy(spec);
    setEntity(null);
    setDraft(null);
    setResolved({ state: "idle" });
    setRefineText(c);
    startRun(`/api/run?${proxyQuery(spec)}${c ? `&c=${encodeURIComponent(c)}` : ""}`, true);
  }

  // Re-run the slate on screen with a new constraints sentence ("" clears it), and keep the share link in step.
  function refine(c: string) {
    c = c.trim().slice(0, 200);
    if (proxy) {
      window.history.pushState(null, "", `/s/p?${proxyQuery(proxy)}${c ? `&c=${encodeURIComponent(c)}` : ""}`);
      loadProxy(proxy, c);
    } else if (entity) {
      window.history.pushState(null, "", `/s/${entity.entity_id}?t=${encodeURIComponent(entity.type)}${c ? `&c=${encodeURIComponent(c)}` : ""}`);
      loadSlate(entity.entity_id, entity.name, entity.type, c);
    }
  }

  function startRun(url: string, takeEntity: boolean) {
    stop();
    setSlate({ state: "loading" });
    setRanking({});
    setBadges({});
    setConstraints(null);
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
      } else if (ev.type === "ranking")
        setRanking((r) => ({ ...r, [ev.domain]: ev.data }));
      else if (ev.type === "mutual") setBadges(ev.data);
      else if (ev.type === "constraints") setConstraints(ev.data);
      else if (ev.type === "done") stop();
      else if (ev.type === "error") fail(ev.message);
    };
    es.onerror = () =>
      source.current === es &&
      fail("Lost the connection while building the slate");
  }

  function choose(card: Card, others: Card[] = []) {
    setEntity(card);
    setAlternates(others);
    setResolved({ state: "idle" });
    setDraft(null);
    window.history.pushState(null, "", `/s/${card.entity_id}?t=${encodeURIComponent(card.type)}`);
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
      const r = await getJson<ResolveResult>(
        `/api/resolve?q=${encodeURIComponent(q)}`,
      );
      if (r.status === "confident")
        choose(r.candidates[0], r.candidates.slice(1));
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
    setResolved({
      state: "ready",
      data: {
        status: alternates.length ? "ambiguous" : "not_found",
        candidates: alternates,
      },
    });
    setDraft({ name: entity?.name ?? query, description: "", brands: [] });
    window.history.pushState(null, "", "/");
  }

  function buildFromProxies(d: ProxyDraft, proxies: Card[], tag?: string) {
    const spec = {
      name: d.name.trim(),
      d: d.description.trim(),
      p: formatProxies(weightsFor(proxies.map((p) => p.entity_id))),
      t: tag,
    };
    window.history.pushState(null, "", `/s/p?${proxyQuery(spec)}`);
    loadProxy(spec);
  }

  // "Edit" on the banner: back to the form with everything prefilled.
  function editProxies(basedOn: Card[]) {
    if (!proxy) return;
    stop();
    setEntity(null); // the proxy card belongs to the run being edited
    setDraft({
      name: proxy.name,
      description: proxy.d,
      brands: basedOn.map((c) => c.name),
    });
    setSlate({ state: "idle" });
    setTrace([]);
    setResolved({ state: "idle" });
    window.history.pushState(null, "", "/");
  }

  // A shared /s/<id> link starts straight at the slate. loadSlate sets loading state up front, which is the point here.
  useEffect(() => {
    if (initialId)
      loadSlate(initialId, undefined, initialType, initialConstraints ?? ""); // eslint-disable-line react-hooks/set-state-in-effect
    else if (initialProxy) loadProxy(initialProxy, initialProxy.c ?? "");
  }, [initialId, initialProxy?.p]); // eslint-disable-line react-hooks/exhaustive-deps -- run once per shared link, not per render

  // Home is the empty page: the promise, the input, the examples. Anything in flight collapses it to a search bar.
  const home = !entity && !proxy && !draft && resolved.state === "idle" && slate.state === "idle";
  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-rule py-3">
        <Link href="/" className="font-display text-xl">
          Crossover
        </Link>
        <Link href="/pair" className={btnQuiet}>
          Check a pairing
        </Link>
      </header>

      <section className={home ? "pt-14 pb-6 sm:pt-24" : "pt-6"}>
        {home && (
          <>
            <h1 className="max-w-[16ch] font-display text-3xl sm:text-4xl">Who should you collab with, and where?</h1>
            <p className="mt-4 max-w-[58ch] text-lg text-ink-2">
              Name a brand, artist, show or person. Crossover finds what their fans already love, the US markets where those fans live, and
              writes the brief.
            </p>
          </>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(query);
          }}
          className={`flex gap-2 ${home ? "mt-8 max-w-[680px] flex-col sm:flex-row" : ""}`}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A brand, artist, show, or person"
            aria-label="A brand, artist, show, or person"
            className={`${field} ${home ? "min-h-13 text-lg" : ""}`}
          />
          <button className={home ? `${btnPrimary} min-h-13` : btnSecondary}>
            Find partners
          </button>
        </form>
        {home && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-base text-ink-3">Try</span>
              {CHIPS.map((c) => (
                <button key={c} onClick={() => lookup(c)} className="min-h-11 rounded-full border border-rule-strong px-4 text-base text-ink hover:border-ink">
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-16 border-t border-rule pt-4 text-sm text-ink-3">Built on Qloo&apos;s taste graph</p>
          </>
        )}
      </section>

      <section className="mt-4 space-y-4 empty:hidden">
        {resolved.state === "loading" && <p className="font-mono text-sm text-ink-3">Looking for &ldquo;{query}&rdquo; in Qloo...</p>}
        {resolved.state === "error" && (
          <p className="rounded-md bg-danger-tint px-4 py-3 text-base text-danger">Couldn&apos;t search Qloo: {resolved.message}</p>
        )}
        {resolved.state === "ready" && resolved.data.status === "ambiguous" && (
          <div>
            <h2 className="font-display text-xl">Which one did you mean?</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {resolved.data.candidates.map((c) => (
                <button key={c.entity_id} onClick={() => choose(c)} className="rounded-lg text-left hover:[&>div]:border-ink">
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

      {trace.length > 0 && <TraceLog lines={trace} running={running} />}

      {slate.state === "loading" && <p className="mt-6 font-mono text-sm text-ink-3 motion-safe:animate-pulse">Building the slate...</p>}
      {slate.state === "error" && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 rounded-md bg-danger-tint px-4 py-2 text-base text-danger">
          <span className="py-2">Couldn&apos;t build the slate: {slate.message}</span>
          {entity && (
            <button onClick={() => loadSlate(entity.entity_id, entity.name, entity.type)} className={btnQuiet}>
              Try again
            </button>
          )}
        </div>
      )}
      {slate.state === "ready" && (
        <Results
          data={slate.data}
          ranking={ranking}
          badges={badges}
          running={running}
          decisions={decisions}
          constraints={constraints}
          refineText={refineText}
          onRefine={refine}
          onOpen={(pick, domain) => setOpen({ pick, domain })}
        />
      )}
      {open && slate.state === "ready" && (
        <BriefPanel
          key={open.pick.entity_id}
          seed={slate.data.entity}
          refine={refineText}
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

// The small confirmation of who the slate is for. Also the picker's option and the proxy run's header.
function MatchCard({ card, onNotIt }: { card: Card; onNotIt?: () => void }) {
  return (
    <div className={`${panel} flex items-center gap-4 p-3 sm:p-4`}>
      <Thumb src={card.image} name={card.name} className="h-14 w-14 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-3">{TYPE_LABEL[card.type] ?? "Entity"}</p>
        <h2 className="truncate font-display text-xl">{card.name}</h2>
        {card.short_description && <p className="line-clamp-1 text-base text-ink-2">{card.short_description}</p>}
      </div>
      {onNotIt && (
        <button onClick={onNotIt} className={btnSecondary}>
          Not it
        </button>
      )}
    </div>
  );
}

// The agent's work as a log. Open while the run streams, folded once it's done. The constraints reading sits apart,
// above the log, because it changes what the slate means.
const CONSTRAINT_LINE = /^(Reading your constraints|Applying: |Couldn't apply: )/;
function TraceLog({ lines, running }: { lines: string[]; running: boolean }) {
  const read = lines.filter((l) => CONSTRAINT_LINE.test(l));
  const log = lines.filter((l) => !CONSTRAINT_LINE.test(l));
  return (
    <div className="mt-6">
      {read.length > 0 && (
        <div className="mb-4 rounded-md bg-surface-2 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Your constraints</h2>
          <ul className="mt-1 space-y-1 text-base text-ink-2">
            {read.map((l) => (
              <li key={l}>{l === "Reading your constraints" && read.length === 1 ? "Reading your constraints..." : l}</li>
            ))}
          </ul>
        </div>
      )}
      {log.length > 0 && (
        <details open={running || undefined} className="group border-y border-rule">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-mono text-sm text-ink-2 hover:text-ink">
            <span>
              Agent log <span className="text-ink-3">&middot; {log.length} steps</span>
            </span>
            <span className="text-ink-3 group-open:hidden">Show</span>
            <span className="hidden text-ink-3 group-open:inline">Hide</span>
          </summary>
          <ol className="space-y-1 pb-3 font-mono text-sm text-ink-2">
            {log.map((l, i) => (
              <li key={l} className="flex gap-3">
                <span className="w-5 shrink-0 text-right tabular-nums text-ink-3">{i + 1}</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

type Row = { pick: Pick; why?: string; reason?: string; flag?: "competitor" | "excluded" | "lower" };

// With a ranking: the shortlist (with why-lines), then picks the agent neither kept nor dropped; ranked-lower and
// dropped picks go behind quiet disclosures. Without one: Qloo's order. Picks you declined join the dropped list.
function arrange(picks: Pick[], r: Ranking[Domain] | undefined, decisions: Record<string, Decision>) {
  const declined = picks.filter((p) => decisions[p.entity_id]?.status === "declined");
  const mine = declined.map((p) => ({
    entity_id: p.entity_id,
    name: p.name,
    reason: `You declined: ${decisions[p.entity_id].reason}`,
  }));
  const live = picks.filter((p) => !declined.includes(p));
  if (!r) return { rows: live.map((pick): Row => ({ pick })), lower: [] as Row[], dropped: mine };
  const byId = new Map(live.map((p) => [p.entity_id, p]));
  const row = (k: Ranking[Domain]["kept"][number]): Row[] =>
    byId.has(k.entity_id)
      ? [
          {
            pick: byId.get(k.entity_id)!,
            why: k.why || undefined,
            reason: k.demoted,
            flag: k.excluded ? "excluded" : k.competitor ? "competitor" : k.demoted ? "lower" : undefined,
          },
        ]
      : [];
  const demoted = r.demoted ?? []; // rankings cached before rank-v3 have no demoted list
  const used = new Set([...r.kept, ...demoted, ...r.dropped].map((d) => d.entity_id));
  return {
    rows: [...r.kept.flatMap(row), ...live.filter((p) => !used.has(p.entity_id)).map((pick): Row => ({ pick }))],
    lower: demoted.flatMap(row),
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
  badges,
  running,
  decisions,
  constraints,
  refineText,
  onRefine,
  onOpen,
}: {
  constraints: ConstraintSet | null;
  refineText: string;
  onRefine: (c: string) => void;
  data: SlateData;
  ranking: Partial<Ranking>;
  badges: Record<string, "mutual" | "partial" | null>;
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
  const rowProps = (row: Row, domain: Domain) => ({
    ...row,
    badge: badges[row.pick.entity_id],
    pairHref:
      data.entity.type === "proxy"
        ? undefined
        : `/pair/${data.entity.entity_id}/${row.pick.entity_id}?ta=${encodeURIComponent(data.entity.type)}&tb=${encodeURIComponent(row.pick.type || `urn:entity:${domain}`)}`,
    drivenBy: chipFor(row.pick),
    approved: decisions[row.pick.entity_id]?.status === "approved",
    onOpen: () => onOpen(row.pick, domain),
  });
  return (
    <div className="mt-10">
      <header className="border-b border-ink pb-6">
        <h2 className="font-display text-2xl sm:text-3xl">Partners for {data.entity.name}</h2>
        <p className="mt-1 max-w-[65ch] text-base text-ink-2">{playbookFor(data.entity.type).slateSubtitle}</p>
        <RefineBar key={refineText} refineText={refineText} constraints={constraints} running={running} onRefine={onRefine} />
        {Object.values(badges).some(Boolean) && (
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2">
            <span className="flex items-center gap-2">
              <Chip kind="mutual" /> their fans rank you in their top 10 too
            </span>
            <span className="flex items-center gap-2">
              <Chip kind="partial" /> in their top 50
            </span>
          </p>
        )}
      </header>

      {data.domains.map(({ domain, picks }) => {
        const { rows, lower, dropped } = arrange(picks, ranking[domain], decisions);
        return (
          <section key={domain} className="border-b border-rule py-8">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-display text-xl">{DOMAIN_LABEL[domain]}</h3>
              {running && !ranking[domain] && <span className="font-mono text-sm text-ink-3 motion-safe:animate-pulse">shortlisting</span>}
            </div>
            {rows.length ? (
              <ol className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => (
                  <PickRow key={row.pick.entity_id} {...rowProps(row, domain)} />
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-base text-ink-2">Nothing here for this audience.</p>
            )}
            {lower.length > 0 && (
              <Disclosure label={`Ranked lower (${lower.length})`}>
                <ol className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                  {lower.map((row) => (
                    <PickRow key={row.pick.entity_id} {...rowProps(row, domain)} />
                  ))}
                </ol>
              </Disclosure>
            )}
            {dropped.length > 0 && (
              <Disclosure label={`Dropped (${dropped.length})`}>
                <ul className="max-w-[75ch] space-y-2 text-base text-ink-2">
                  {dropped.map((d) => (
                    <li key={d.entity_id}>
                      <span className="font-semibold text-ink">{d.name}</span>: {d.reason}
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </section>
        );
      })}

      <section className="py-10">
        <h3 className="font-display text-xl">Where to launch</h3>
        <p className="mt-1 text-base text-ink-2">Over-index against the US average, where 100 is average.</p>
        <div className="mt-6 grid items-start gap-8 md:grid-cols-[3fr_2fr]">
          <UsMap cells={data.cities.cells} metros={data.cities.metros} hovered={hovered} />
          <div>
            {even && (
              <p className="mb-4 rounded-md bg-surface-2 px-4 py-3 text-base text-ink-2">
                <span className="font-semibold text-ink">Close race.</span> Fans are spread evenly across these markets, so any of the top five
                is a fair place to start.
              </p>
            )}
            {data.cities.metros.length ? (
              <ol>
                {data.cities.metros.slice(0, 10).map((m, i) => (
                  <li
                    key={m.name}
                    onMouseEnter={() => setHovered(m.name)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setHovered((h) => (h === m.name ? null : m.name))} // tap to highlight on touch screens
                    className={`flex min-h-11 cursor-default items-center gap-3 border-t border-rule px-1 ${hovered === m.name ? "bg-surface-2" : ""}`}
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-ink-3">{i + 1}</span>
                    <span className={`flex-1 ${i < 3 ? "text-lg font-semibold" : "text-base text-ink-2"}`}>{m.name}</span>
                    <span className={`tabular-nums ${i < 3 ? "text-lg font-semibold" : "text-base text-ink-2"}`}>{m.overIndex}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-base text-ink-2">Not enough heatmap data to rank US cities for this one.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group mt-4">
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-base text-ink-2 hover:text-ink">
        <span aria-hidden className="inline-block text-ink-3 transition-transform group-open:rotate-90 motion-reduce:transition-none">
          &#9656;
        </span>
        {label}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function PickRow({
  pick,
  why,
  reason,
  flag,
  badge,
  pairHref,
  drivenBy,
  approved,
  onOpen,
}: Row & {
  badge?: "mutual" | "partial" | null;
  pairHref?: string;
  drivenBy?: string;
  approved?: boolean;
  onOpen: () => void;
}) {
  const tags = [...new Set(pick.tags)].slice(0, 2);
  return (
    <li className="flex flex-col border-t border-rule pt-4 pb-2">
      <button onClick={onOpen} className="group flex flex-col rounded-md text-left">
        <div className="flex gap-4">
          <Thumb src={pick.image} name={pick.name} className="h-16 w-16 rounded-md" />
          <div className="min-w-0 flex-1">
            <h4 className="line-clamp-2 text-base font-semibold leading-snug group-hover:underline">{pick.name}</h4>
            <div className="mt-1.5 flex items-center gap-2" title="Affinity: how much this audience over-indexes on it">
              <div className="h-1 flex-1 rounded-full bg-rule">
                <div className="h-1 rounded-full bg-accent" style={{ width: `${Math.round(pick.affinity * 100)}%` }} />
              </div>
              <span className="text-sm tabular-nums text-ink-3">{pick.affinity.toFixed(2)}</span>
            </div>
            {(badge || approved || flag || drivenBy) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {badge && <Chip kind={badge} title={badge === "mutual" ? "Their fans rank you in their top 10 too" : "Their fans rank you in their top 50"} />}
                {approved && <Chip kind="approved" />}
                {flag && <Chip kind={flag} />}
                {drivenBy && <Chip kind="note">Driven by {drivenBy}</Chip>}
              </div>
            )}
          </div>
        </div>
        {why && <p className="mt-3 text-base text-ink">{why}</p>}
        {reason && <p className="mt-1 text-base text-ink-2">{reason}</p>}
        {tags.length > 0 && <p className="mt-2 text-sm text-ink-3">{tags.join(" · ")}</p>}
      </button>
      {pairHref && (
        <Link href={pairHref} className={`${btnQuiet} self-start text-sm`}>
          Check this pairing
        </Link>
      )}
    </li>
  );
}

function Thumb({ src, name, className }: { src?: string; name: string; className: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${className} shrink-0 bg-surface-2 object-cover`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center bg-surface-2 font-display text-xl text-ink-3`}>{name.slice(0, 1)}</div>
  );
}

// Refine (PLAN.md section 2 step 8): one sentence of constraints re-plans the run. Applied constraints show as
// chips; removing one re-runs without its phrase. What couldn't be mapped shows in the constraints box above the log.
function RefineBar({
  refineText,
  constraints,
  running,
  onRefine,
}: {
  refineText: string;
  constraints: ConstraintSet | null;
  running: boolean;
  onRefine: (c: string) => void;
}) {
  const [value, setValue] = useState(refineText);
  const without = (phrase: string) =>
    (constraints?.applied ?? [])
      .map((a) => a.phrase)
      .filter((p) => p !== phrase)
      .join(", ");
  return (
    <div className="mt-5 max-w-[760px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onRefine(value);
        }}
        className="flex gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Refine: non-alcoholic only, launch in Texas, brands and artists only"
          aria-label="Refine the slate"
          maxLength={200}
          className={field}
        />
        <button disabled={running || !value.trim()} className={btnSecondary}>
          Refine
        </button>
      </form>
      {constraints && constraints.applied.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {constraints.applied.map((a) => (
            <button
              key={a.phrase + a.label}
              onClick={() => onRefine(without(a.phrase))}
              disabled={running}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-rule-strong bg-surface-2 px-3 text-sm text-ink hover:border-ink disabled:opacity-50 sm:min-h-9"
              title={`Remove "${a.phrase}" and re-run`}
            >
              {a.label}
              <span aria-hidden className="text-ink-3">
                &times;
              </span>
            </button>
          ))}
          {refineText && (
            <button onClick={() => onRefine("")} disabled={running} className={`${btnQuiet} text-sm`}>
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
