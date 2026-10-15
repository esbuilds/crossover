import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { PerRequest } from "@/app/dynamic";
import { btnQuiet } from "@/app/ui";
import CollisionMap from "@/app/vs/collision-map";
import PrintButton from "./print-button";
import { peekAsk } from "@/lib/ask/agent.ts";
import { bodyFromParams } from "@/lib/ask/body.ts";
import { PROOF } from "@/lib/ask/proof.ts";
import blocked from "@/lib/ask/blocked.json";
import { sheetModel } from "@/lib/ask/sheet.ts";
import { whereToStart } from "@/lib/ask/where.ts";
import { bothWays } from "@/lib/ask/both-ways.ts";
import { BothTable } from "../../both-table";
import { mapLine } from "@/lib/vs.ts";
import { peekVs } from "@/lib/rivals.ts";
import { TONE } from "@/lib/collide.ts";

// The call sheet (Pick 2, Oct 14): /ask/<id>/sheet?t=<type>. One printed page from a cached ask only; an ask that isn't
// cached shows the waiting state and never spends.
export const metadata: Metadata = { title: "Call sheet", robots: { index: false, follow: false } };

export default function SheetPage({ params, searchParams }: PageProps<"/ask/[id]/sheet">) {
  return (
    <>
      <PerRequest />
      <main className="mx-auto max-w-[7.5in] px-4 pb-16 text-ink print:max-w-none print:px-0 print:pb-0">
        <Suspense fallback={<p className="pt-10 text-base text-ink-2">Reading the cached ask...</p>}>
          <Sheet params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Sheet({ params, searchParams }: Pick<PageProps<"/ask/[id]/sheet">, "params" | "searchParams">) {
  await connection();
  const [{ id }, sp] = [await params, await searchParams];
  const body = bodyFromParams(id, sp);
  const cached = body ? await peekAsk(body).catch(() => null) : null;
  const seedId = (cached?.find((e) => e.type === "result" && e.n === 1) as { output?: { id?: string } } | undefined)?.output?.id;
  const events = cached && seedId?.toUpperCase() === id.toUpperCase() ? cached : null;
  const s = events ? sheetModel(events, { proof: PROOF, blocked: blocked.length }) : null;
  if (!body || !s)
    return (
      <p className="pt-10 text-base text-ink-2">
        No sheet yet: this ask hasn&apos;t been run, or its answer was blocked. <Link href={`/ask/${id}?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"))}`} className={btnQuiet}>Open the ask</Link>
      </p>
    );
  const where = events ? await whereToStart(events, null).catch(() => null) : null; // cache only on the sheet
  const both = events ? await bothWays(events, null).catch(() => null) : null; // cache only; one page or it comes off
  const vs = s.map ? await peekVs({ id: s.map.seed.id!, type: s.map.seed.type! }, { id: s.map.rival.id!, type: s.map.rival.type! }).catch(() => null) : null;
  const cells = vs && vs !== "cold" ? vs.map : null;
  const cities = s.map ? mapLine(s.map.seed.name, s.map.rival.name, { metrosA: s.map.seedMarkets.map((name) => ({ name })), metrosB: s.map.rivalMarkets.map((name) => ({ name })) } as unknown as Parameters<typeof mapLine>[2]) : null;
  const fn = (ns: number[]) => <sup className="ml-0.5 font-mono text-[0.7em] text-ink-3">{ns.join(",")}</sup>;

  return (
    <article className="pt-6 text-[13px] leading-snug print:pt-0 print:text-[11px]">
      <header className="flex items-baseline justify-between border-b border-rule-strong pb-2">
        <p className="font-display text-lg">Crossover · call sheet</p>
        <p className="print:hidden"><PrintButton /></p>
      </header>
      <h1 className="mt-3 font-display text-2xl">{s.question}</h1>
      {/* the same call card as the page (Fable tie ruling, Oct 14): two lines, two labels */}
      <div className="mt-2 rounded-sm border border-rule-strong px-3 py-2">
        <p className="text-base font-semibold">{s.card.first}</p>
        {s.card.where && <p className="text-ink-2">{s.card.where}</p>}
        {where?.line && <p className="text-ink-2">{where.line}</p>}
      </div>

      <section className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-display text-base">{s.heading}</h2>
          <p className="text-ink-2">{s.calls[0].reason}{fn(s.calls[0].steps)}</p>
          {both && <BothTable b={both} compact />}
          {s.tiedNote && <p className="mt-1.5 text-[0.9em] text-ink-3">{s.tiedNote}</p>}
          <ul className="mt-1.5 space-y-1.5">
            {s.calls.slice(1).map((c, i) => (
              <li key={c.name + i}>
                <span className="font-semibold">{s.tiedNote ? "" : `${i + 2}. `}{c.name}.</span> {c.reason}{fn(c.steps)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-ink-2">{s.doubles}{s.doublesStep ? fn([s.doublesStep]) : null}</p>
        </div>
        {s.map && (
          <figure className="w-full sm:w-[2.6in] print:w-[2.2in]">
            {cells && <CollisionMap cells={cells.cells} metrosA={cells.metrosA} metrosB={cells.metrosB} a={s.map.seed.name} b={s.map.rival.name} />}
            {/* persona test, Oct 14: the map needs its own legend on a forwarded page */}
            <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-2">
              {(["a", "b", "both"] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full" style={{ background: TONE[k] }} aria-hidden />{k === "a" ? `Leans ${s.map!.seed.name}` : k === "b" ? `Leans ${s.map!.rival.name}` : "Both"}</span>
              ))}
            </p>
            <figcaption className="mt-1 text-[11px] text-ink-2">
              {s.map.closerToSeed} brands sit closer to {s.map.seed.name}, {s.map.closerToRival} closer to {s.map.rival.name}, {s.map.withinGapOfBoth} within 0.05 of both. {cities}
            </figcaption>
          </figure>
        )}
      </section>

      {s.notes.length > 0 && (
        <section className="mt-3">
          <h2 className="font-display text-base">Notes from the agent, each checked against its steps</h2>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-2">
            {s.notes.map((n) => <li key={n.text}>{n.text}{fn(n.steps)}</li>)}
          </ul>
        </section>
      )}

      <section className="mt-3 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <div>
          <h2 className="font-display text-base">Steps (each measured in Qloo)</h2>
          <ol className="mt-1 space-y-0.5 text-ink-2">
            {s.footnotes.map((f) => <li key={f.n}><span className="font-mono text-ink-3">{f.n}</span> {f.label}: {f.summary}</li>)}
          </ol>
        </div>
        <div>
          <h2 className="font-display text-base">What this doesn&apos;t establish</h2>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-2">
            {s.limits.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
      </section>

      <footer className="mt-3 border-t border-rule pt-2 text-ink-2">
        <p>{s.proof}</p>
        {body?.caseKey && <p className="mt-1">Replay case, a demonstration, not a test: the agent was given the case&apos;s eight in alphabetical order, without knowing which was the real partner.</p>}
        <p className="mt-1">{s.blocked}</p>
        <p className="mt-1 text-ink-3">{s.credit} crossover-henna.vercel.app/ask/{id.toUpperCase()} · printed {new Date().toISOString().slice(0, 10)}</p>
      </footer>
    </article>
  );
}
