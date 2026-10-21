// The rivals result (brief-oct12-front): shared by the front door (client) and /vs (server). No hooks, no server
// imports. Every word comes from code or from Qloo.
import Link from "next/link";
import { btnText, chip, Chip } from "@/app/ui";
import type { RivalRow, VsPayload, Xray } from "@/lib/rivals.ts";
import { DOESNT_ESTABLISH, emptyColumn, mapLine, rankContext, verdict, vsState } from "@/lib/vs.ts";
import { PAIR_CASE, VS_CASES, vsHref } from "@/lib/rivals-cases.ts";
import { LEAN_SPLIT } from "@/lib/collide.ts";
import CollisionMap, { MapKey } from "./collision-map";
import OpenOnHash from "./open-on-hash";

const SHOWN = 10; // rows per column before "Show all", from 640 px up
const SHOWN_SMALL = 5; // under 640 px

export function Calm({ message }: { message: string }) {
  return (
    <section className="mt-block">
      <p className="text-lg text-ink">{message}</p>
      <PreparedPairs />
    </section>
  );
}

export function PreparedPairs() {
  return (
    <p className="mt-3 flex flex-wrap gap-2">
      {VS_CASES.map((c) => (
        <Link key={c.a.id} href={vsHref(c)} prefetch={false} className={chip}>
          {c.a.name} vs {c.b.name}
        </Link>
      ))}
    </p>
  );
}

// method: the rival finder's line and its chips, under the names and as log step 0 (front door only)
export function VsResult({ d, method }: { d: VsPayload; method?: { line: string; node: React.ReactNode } }) {
  const r = d.rivals;
  const A = r.a.name, B = r.b.name;
  const total = r.leansA.length + r.leansB.length + r.shared.length + r.sameField.length + r.noData.length;
  const chunks = Math.ceil(total / 50);
  const log = [
    `Looked up ${A} and ${B} by Qloo id`,
    `Top 50 brands under the ${A} signal (insights, take 50)`,
    `Top 50 brands under the ${B} signal (insights, take 50)`,
    `Scored all ${total} candidates under ${A} (filter.results.entities, ${chunks} call${chunks === 1 ? "" : "s"})`,
    `Scored all ${total} candidates under ${B} (filter.results.entities, ${chunks} call${chunks === 1 ? "" : "s"})`,
    `Missing rule and the 0.05 gap applied; ${r.sameField.length} in their own field set aside, ${r.noData.length} with no data`,
    `Compared ${A} and ${B} (insights/compare): ${d.share.length ? d.share.join(", ") : "no shared category tags"}`,
    ...(d.map
      ? [`Heatmap for ${A} (urn:heatmap, United States)`, `Heatmap for ${B} (urn:heatmap, United States); ${d.map.matched} cells both carry, ${d.map.cells.length} drawn`]
      : []),
    ...(d.xray?.length
      ? [`Same test beyond brands (${d.xray.map((x) => DOMAIN[x.type]).join(", ")}): each side's top 50 per domain, every candidate scored under both`]
      : []),
  ];
  const state = vsState(r);
  const [line, stateLine] = verdict(r);
  const markets = mapLine(A, B, d.map);
  return (
    <>
      {/* under 640 px the map comes before the verdict (CSS order, one copy of each); from 640 up, the verdict first.
          From 1024 the map sits beside the verdict (WOW F3), so the picture is in the first screen at 1280 instead of
          a page-wide map 700 px down. */}
      <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-12">
        <header className="order-1 mt-block lg:col-span-2">
          {/* the page's h1 is the question above the form (DC F8); the pair is the result's headline */}
          <h2 className="font-display text-2xl">
            {A} <span className="font-italic-display text-ink-3">vs</span> {B}
          </h2>
          {(r.a.kind.length > 0 || r.b.kind.length > 0) && (
            <p className="mt-1 text-sm text-ink-3">
              {[r.a, r.b].map((s) => (s.kind.length ? `${s.name}: ${s.kind.join(", ")}` : null)).filter(Boolean).join(" · ")}
            </p>
          )}
          {method && <div className="mt-3">{method.node}</div>}
        </header>
        <div className="order-3 sm:order-2 lg:col-start-1 lg:row-start-2">
          <p className="mt-6 max-w-lead text-lg text-ink">
            <Cite checks="4 and 5">{line}</Cite>
          </p>
          {markets && (
            <p className="mt-1 max-w-lead text-lg text-ink">
              <Cite checks="8 and 9">{markets}</Cite>
            </p>
          )}
          {stateLine && <p className="mt-3 max-w-copy text-base text-ink-2">{stateLine}</p>}
          {d.share.length > 0 && (
            <p className="mt-3 text-sm">
              <Chip kind="note" title="From Qloo check 7 (Qloo compare)">
                Share by category: {[...new Map(d.share.map((t) => [t.toLowerCase(), t])).values()].join(", ")}
              </Chip>
            </p>
          )}
        </div>
        <div className="order-2 sm:order-3 lg:col-start-2 lg:row-start-2">
          <MapSection d={d} />
        </div>
      </div>

      <section className={`mt-block grid gap-x-12 gap-y-block ${state === "two lists" ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        <Column title={`Sits closer to ${A}`} rows={r.leansA} d={d} side="a" empty={emptyColumn(A)} />
        <Column title={`Sits closer to ${B}`} rows={r.leansB} d={d} side="b" empty={emptyColumn(B)} />
        {state !== "two lists" && <Column title="Within 0.05 of both" rows={r.shared} d={d} side="a" empty="No candidate sits within 0.05 of both." />}
      </section>
      {state === "two lists" && (
        <p className="mt-6 text-base text-ink-2">
          Within 0.05 of both: {r.shared.length ? r.shared.map((x) => x.name).join(", ") : "none"}.
        </p>
      )}

      {/* folded by default since Pick A (Oct 13): one judge path, the X-ray one click away */}
      {d.xray?.length ? (
        <FoldBox label={`Beyond brands: the same split in ${d.xray.length} more Qloo domains`} className="mt-block border-t">
          <XraySection d={d} rows={d.xray} check={log.length} />
        </FoldBox>
      ) : null}

      <Fold label={`Same field: ${r.sameField.length}`} rows={r.sameField} d={d} note={`Measured, and set aside from the columns: they share a category with ${A} or ${B}.`} />
      {r.noData.length > 0 && <Fold label={`No data: ${r.noData.length}`} rows={r.noData} d={d} note="Qloo returned a fallback value for these, so they are never ranked or scored." />}

      {r.a.entity_id.toUpperCase() === PAIR_CASE.a && r.b.entity_id.toUpperCase() === PAIR_CASE.b && (
        <FoldBox label={PAIR_CASE.label} id={PAIR_CASE.id} className="mt-block">
          <div className="max-w-copy space-y-3 pb-4 text-base text-ink-2">
            {PAIR_CASE.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </FoldBox>
      )}
      <FoldBox label="What this doesn't establish" className={r.a.entity_id.toUpperCase() === PAIR_CASE.a && r.b.entity_id.toUpperCase() === PAIR_CASE.b ? "" : "mt-block"}>
        <ul className="max-w-copy list-disc space-y-1 pb-3 pl-5 text-base text-ink-2">
          {DOESNT_ESTABLISH.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </FoldBox>

      <FoldBox label={`${log.length + (method ? 1 : 0)} Qloo steps`}>
        <ol className="space-y-1 pb-3 font-mono text-sm text-ink-2">
          {method && (
            <li id="check-0" className="flex gap-3">
              <span className="w-5 shrink-0 text-right tabular-nums text-ink-3">0</span>
              <span>{method.line}</span>
            </li>
          )}
          {log.map((t, i) => (
            <li key={i} id={`check-${i + 1}`} className="flex gap-3">
              <span className="w-5 shrink-0 text-right tabular-nums text-ink-3">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </FoldBox>
    </>
  );
}

// the brief panel's fold: one monospace line with Show / Hide, ruled underneath (app/brief-panel.tsx BriefLog)
function FoldBox({ label, id, className = "", children }: { label: string; id?: string; className?: string; children: React.ReactNode }) {
  return (
    <details id={id} className={`group scroll-mt-4 border-b border-rule ${className}`}>
      {id && <OpenOnHash id={id} />}
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-mono text-sm text-ink-2 hover:text-ink">
        <span>{label}</span>
        <span className="shrink-0 text-ink-3 group-open:hidden">Show</span>
        <span className="hidden shrink-0 text-ink-3 group-open:inline">Hide</span>
      </summary>
      {children}
    </details>
  );
}

function MapSection({ d }: { d: VsPayload }) {
  const A = d.rivals.a.name, B = d.rivals.b.name;
  if (!d.map) return <p className="mt-block border-t border-rule pt-6 text-base text-ink-2">No geographic story for a person: a person&apos;s heatmap is flat across markets, so the map is left off.</p>;
  const m = d.map;
  return (
    <section className="mt-block lg:mt-4">
      <h3 className="text-sm text-ink-3">Where the audiences split</h3>
      <CollisionMap cells={m.cells} metrosA={m.metrosA} metrosB={m.metrosB} a={A} b={B} />
      <MapKey a={A} b={B} />
      <p className="mt-2 max-w-lead text-sm text-ink-2">
        <Cite checks="8 and 9">Where each audience over-indexes in Qloo&apos;s heatmaps, cell by cell.</Cite> A cell leans one way when it sits {LEAN_SPLIT === 0.25 ? "a quarter" : LEAN_SPLIT} of the ranking higher in that heatmap. Cells only one heatmap covers are left off.
      </p>
      <p className="mt-2 text-sm text-ink-2">
        Top markets. {A}: {m.metrosA.map((x) => x.name).join(", ")}. {B}: {m.metrosB.map((x) => x.name).join(", ")}.
      </p>
    </section>
  );
}

const DOMAIN: Record<string, string> = { "urn:entity:artist": "artists", "urn:entity:tv_show": "TV", "urn:entity:movie": "film", "urn:entity:podcast": "podcasts" };

// the X-ray (real Oct 13): the columns' test in four more domains, counts and the three widest gaps per side
function XraySection({ d, rows, check }: { d: VsPayload; rows: Xray[]; check: number }) {
  const A = d.rivals.a.name, B = d.rivals.b.name;
  const names = (xs: Xray["topA"]) => xs.map((x) => `${x.name} ${x.a.toFixed(2)}/${x.b.toFixed(2)}`).join(", ");
  return (
    <section className="pb-4">
      <h2 className="sr-only">Beyond brands</h2>
      <p className="mt-1 max-w-lead text-sm text-ink-2">
        <Cite checks={String(check)}>The same test in four more Qloo domains</Cite>: each side&apos;s top 50, scored under both names, split at 0.05. Scores are {A}/{B}.
      </p>
      <dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
        {rows.map((x) => (
          <div key={x.type} className="min-w-0 border-t border-rule pt-3">
            <dt className="text-base font-semibold text-ink">
              {DOMAIN[x.type][0].toUpperCase() + DOMAIN[x.type].slice(1)}{" "}
              <span className="block text-sm font-normal text-ink-3 tabular-nums">
                {x.leansA} closer to {A} · {x.leansB} closer to {B} · {x.shared} within 0.05 of both
              </span>
            </dt>
            {x.topA.length > 0 && <dd className="mt-1 text-sm text-ink-2 tabular-nums">{A}: {names(x.topA)}</dd>}
            {x.topB.length > 0 && <dd className="mt-1 text-sm text-ink-2 tabular-nums">{B}: {names(x.topB)}</dd>}
            {!x.topA.length && !x.topB.length && <dd className="mt-1 text-sm text-ink-2">No split here: their fans favor the same {DOMAIN[x.type]}.</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

// a number tied to its log line, as the brief panel does
function Cite({ checks, children }: { checks: string; children: React.ReactNode }) {
  return (
    // a trailing citation tag, like the ask's "step n", instead of a dotted underline that read as a dead link (DC F8)
    <>
      {children} <CheckTag checks={checks} />
    </>
  );
}

export function CheckTag({ checks }: { checks: string }) {
  return <span className="whitespace-nowrap font-mono text-sm text-ink-3">Qloo check{checks.includes(" ") ? "s" : ""} {checks}</span>;
}

function Column({ title, rows, d, side, empty }: { title: string; rows: RivalRow[]; d: VsPayload; side: "a" | "b"; empty: string }) {
  return (
    <div className="min-w-0">
      <h2 className="font-display text-xl">
        {title} <span className="font-sans text-base font-normal text-ink-3 tabular-nums">{rows.length}</span>
      </h2>
      {rows.length ? (
        <>
          {/* five rows on small screens, ten from 640 up; "Show all" appears where rows are hidden */}
          <Rows rows={rows.slice(0, SHOWN)} d={d} side={side} cls={(i) => (i >= SHOWN_SMALL ? "max-sm:hidden" : "")} />
          {rows.length > SHOWN_SMALL && (
            <details className={`group ${rows.length > SHOWN ? "" : "sm:hidden"}`}>
              <summary className={`${btnText} cursor-pointer`}>
                <span className="group-open:hidden">Show all {rows.length}</span>
                <span className="hidden group-open:inline">Show fewer</span>
              </summary>
              <Rows rows={rows.slice(SHOWN_SMALL)} d={d} side={side} cls={(i) => (i < SHOWN - SHOWN_SMALL ? "sm:hidden" : "")} />
            </details>
          )}
        </>
      ) : (
        <p className="mt-3 text-base text-ink-2">{empty}</p>
      )}
    </div>
  );
}

function Fold({ label, rows, d, note }: { label: string; rows: RivalRow[]; d: VsPayload; note: string }) {
  if (!rows.length) return null;
  return (
    <FoldBox label={label} className="mt-8 border-t">
      <p className="text-base text-ink-2">{note}</p>
      <div className="grid gap-x-8 pb-3 lg:grid-cols-3">
        <Rows rows={rows} d={d} side="a" />
      </div>
    </FoldBox>
  );
}

function Rows({ rows, d, side, cls }: { rows: RivalRow[]; d: VsPayload; side: "a" | "b"; cls?: (i: number) => string }) {
  const r = d.rivals;
  const seed = side === "a" ? r.a : r.b;
  return (
    <ul className="contents [&>li]:min-w-0">
      {rows.map((row, i) => (
        <li key={row.id} className={`border-t border-rule py-3 first:mt-3 ${cls?.(i) ?? ""}`}>
          <Link prefetch={false} href={`/pair/${seed.entity_id}/${row.id}?ta=${encodeURIComponent(seed.type)}&tb=urn%3Aentity%3Abrand`} className="inline-flex min-h-11 items-center text-base font-medium text-ink underline-offset-4 hover:underline">
            {row.name}
          </Link>
          {row.kind.length > 0 && <p className="-mt-2 text-sm text-ink-3">{row.kind.join(", ")}</p>}
          {row.a !== null && row.b !== null ? (
            <>
              <Bar who={r.a.name} v={row.a} tone="bg-accent" check={4} />
              <Bar who={r.b.name} v={row.b} tone="bg-ink-2" check={5} />
              <p className="mt-1 text-sm text-ink-2 tabular-nums">
                Gap {Math.abs(row.a - row.b).toFixed(2)} · <Cite checks="2 and 3">{rankContext(row, r.a.name, r.b.name)}</Cite>
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-2">No data</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Bar({ who, v, tone, check }: { who: string; v: number; tone: string; check: number }) {
  return (
    <div className="mt-1 flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 truncate text-ink-3">{who}</span>
      <span className="h-2 min-w-0 flex-1 rounded-sm bg-surface-2">
        <span className={`block h-2 rounded-sm ${tone}`} style={{ width: `${Math.round(v * 100)}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right tabular-nums text-ink" title={`From Qloo check ${check}`}>
        {v.toFixed(2)}
      </span>
    </div>
  );
}
