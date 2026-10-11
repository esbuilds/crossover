// The rivals result (brief-oct12-front): shared by the front door (client) and /vs (server). No hooks, no server
// imports. Every word comes from code or from Qloo.
import Link from "next/link";
import { btnQuiet } from "@/app/ui";
import type { RivalRow, VsPayload } from "@/lib/rivals.ts";
import { DOESNT_ESTABLISH, emptyColumn, mapLine, rankContext, verdict, vsState } from "@/lib/vs.ts";
import { VS_CASES, vsHref } from "@/lib/rivals-cases.ts";
import { LEAN_SPLIT, TONE } from "@/lib/collide.ts";
import CollisionMap from "./collision-map";

const SHOWN = 10; // rows per column before "Show all"

export function Calm({ message }: { message: string }) {
  return (
    <section className="mt-10">
      <p className="text-lg text-ink">{message}</p>
      <PreparedPairs />
    </section>
  );
}

export function PreparedPairs() {
  return (
    <p className="mt-3 flex flex-wrap gap-x-4">
      {VS_CASES.map((c) => (
        <Link key={c.a.id} href={vsHref(c)} prefetch={false} className={btnQuiet}>
          {c.a.name} vs {c.b.name}
        </Link>
      ))}
    </p>
  );
}

export function VsResult({ d }: { d: VsPayload }) {
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
  ];
  const state = vsState(r);
  const [line, stateLine] = verdict(r);
  const markets = mapLine(A, B, d.map);
  return (
    <>
      <header className="mt-8">
        <h1 className="font-display text-2xl sm:text-3xl">
          {A} <span className="text-ink-3">vs</span> {B}
        </h1>
        {(r.a.kind.length > 0 || r.b.kind.length > 0) && (
          <p className="mt-1 text-sm text-ink-3">
            {[r.a, r.b].map((s) => (s.kind.length ? `${s.name}: ${s.kind.join(", ")}` : null)).filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="mt-4 max-w-[68ch] text-lg text-ink">
          <Cite checks="4 and 5">{line}</Cite>
          {markets && (
            <>
              {" "}
              <Cite checks="8 and 9">{markets}</Cite>
            </>
          )}
        </p>
        {stateLine && <p className="mt-2 max-w-[68ch] text-base text-ink-2">{stateLine}</p>}
        {d.share.length > 0 && (
          <p className="mt-3 text-sm">
            <span className="inline-flex min-h-8 items-center rounded-sm border border-rule-strong px-2 text-ink" title="From Qloo check 7 (Qloo compare)">
              Share by category: {d.share.join(", ")}
            </span>
            <span className="ml-2 text-ink-3">Qloo compare</span>
          </p>
        )}
      </header>

      <MapSection d={d} />

      <section className={`mt-8 grid gap-8 ${state === "two lists" ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        <Column title={`Sits closer to ${A}`} rows={r.leansA} d={d} side="a" empty={emptyColumn(A)} />
        <Column title={`Sits closer to ${B}`} rows={r.leansB} d={d} side="b" empty={emptyColumn(B)} />
        {state !== "two lists" && <Column title="Within 0.05 of both" rows={r.shared} d={d} side="a" empty="No candidate sits within 0.05 of both." />}
      </section>
      {state === "two lists" && (
        <p className="mt-6 text-base text-ink-2">
          Within 0.05 of both: {r.shared.length ? r.shared.map((x) => x.name).join(", ") : "none"}.
        </p>
      )}

      <Fold label={`Same field: ${r.sameField.length}`} rows={r.sameField} d={d} note={`Measured, and set aside from the columns: they share a category with ${A} or ${B}.`} />
      {r.noData.length > 0 && <Fold label={`No data: ${r.noData.length}`} rows={r.noData} d={d} note="Qloo returned a fallback value for these, so they are never ranked or scored." />}

      <section className="mt-10 border-t border-rule pt-4">
        <h2 className="font-display text-xl">What this doesn&apos;t establish</h2>
        <ul className="mt-2 max-w-[68ch] list-disc space-y-1 pl-5 text-base text-ink-2">
          {DOESNT_ESTABLISH.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <details className="group mt-6 border-b border-rule">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-mono text-sm text-ink-2 hover:text-ink">
          <span>{log.length} Qloo steps</span>
          <span className="text-ink-3 group-open:hidden">Show</span>
          <span className="hidden text-ink-3 group-open:inline">Hide</span>
        </summary>
        <ol className="space-y-1 pb-3 font-mono text-sm text-ink-2">
          {log.map((t, i) => (
            <li key={i} id={`check-${i + 1}`} className="flex gap-3">
              <span className="w-5 shrink-0 text-right tabular-nums text-ink-3">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}

function MapSection({ d }: { d: VsPayload }) {
  const A = d.rivals.a.name, B = d.rivals.b.name;
  if (!d.map) return <p className="mt-8 border-t border-rule pt-4 text-base text-ink-2">No geographic story for a person: a person&apos;s heatmap is flat across markets, so the map is left off.</p>;
  const m = d.map;
  const swatch = (tone: keyof typeof TONE, label: string) => (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block size-3 rounded-full" style={{ background: TONE[tone] }} aria-hidden />
      {label}
    </span>
  );
  return (
    <section className="mt-8">
      <CollisionMap cells={m.cells} metrosA={m.metrosA} metrosB={m.metrosB} a={A} b={B} />
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
        {swatch("a", `Leans ${A}`)}
        {swatch("b", `Leans ${B}`)}
        {swatch("both", "Both")}
      </p>
      <p className="mt-2 max-w-[68ch] text-sm text-ink-2">
        <Cite checks="8 and 9">Where each audience over-indexes in Qloo&apos;s heatmaps, cell by cell.</Cite> A cell leans one way when it sits {LEAN_SPLIT === 0.25 ? "a quarter" : LEAN_SPLIT} of the ranking higher in that heatmap. Cells only one heatmap covers are left off.
      </p>
      <p className="mt-2 text-sm text-ink-2">
        Top markets. {A}: {m.metrosA.map((x) => x.name).join(", ")}. {B}: {m.metrosB.map((x) => x.name).join(", ")}.
      </p>
    </section>
  );
}

// a number tied to its log line, as the brief panel does
function Cite({ checks, children }: { checks: string; children: React.ReactNode }) {
  return (
    <span title={`From Qloo check${checks.includes(" ") ? "s" : ""} ${checks}`} className="cursor-help underline decoration-rule-strong decoration-dotted underline-offset-4">
      {children}
    </span>
  );
}

function Column({ title, rows, d, side, empty }: { title: string; rows: RivalRow[]; d: VsPayload; side: "a" | "b"; empty: string }) {
  return (
    <div className="min-w-0">
      <h2 className="font-display text-xl">
        {title} <span className="font-sans text-base font-normal text-ink-3 tabular-nums">{rows.length}</span>
      </h2>
      {rows.length ? (
        <>
          <Rows rows={rows.slice(0, SHOWN)} d={d} side={side} />
          {rows.length > SHOWN && (
            <details className="group">
              <summary className={`${btnQuiet} cursor-pointer`}>
                <span className="group-open:hidden">Show all {rows.length}</span>
                <span className="hidden group-open:inline">Show fewer</span>
              </summary>
              <Rows rows={rows.slice(SHOWN)} d={d} side={side} />
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
    <details className="group mt-8 border-t border-rule">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-display text-xl hover:text-ink">
        <span>{label}</span>
        <span className="font-sans text-base text-ink-3 group-open:hidden">Show</span>
        <span className="hidden font-sans text-base text-ink-3 group-open:inline">Hide</span>
      </summary>
      <p className="text-base text-ink-2">{note}</p>
      <div className="grid gap-x-8 lg:grid-cols-3">
        <Rows rows={rows} d={d} side="a" />
      </div>
    </details>
  );
}

function Rows({ rows, d, side }: { rows: RivalRow[]; d: VsPayload; side: "a" | "b" }) {
  const r = d.rivals;
  const seed = side === "a" ? r.a : r.b;
  return (
    <ul className="contents [&>li]:min-w-0">
      {rows.map((row) => (
        <li key={row.id} className="border-t border-rule py-3 first:mt-3">
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
