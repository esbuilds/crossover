import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { PerRequest } from "@/app/dynamic";
import { btnQuiet } from "@/app/ui";
import CollisionMap from "@/app/vs/collision-map";
import PrintButton from "./print-button";
import { peekAsk } from "@/lib/ask/agent.ts";
import { parseAskBody } from "@/lib/ask/body.ts";
import { PROOF } from "@/lib/ask/proof.ts";
import blocked from "@/lib/ask/blocked.json";
import { sheetModel } from "@/lib/ask/sheet.ts";
import { mapLine } from "@/lib/vs.ts";
import { peekVs } from "@/lib/rivals.ts";

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
  const body = typeof sp.case === "string" ? parseAskBody({ case: sp.case }) : parseAskBody({ id, type: typeof sp.t === "string" ? sp.t : "urn:entity:brand" });
  const events = body?.id && body.type && body.id === id.toUpperCase() ? await peekAsk(body.caseKey ? { id: body.id, type: body.type, caseKey: body.caseKey } : { id: body.id, type: body.type }).catch(() => null) : null;
  const s = events ? sheetModel(events, { proof: PROOF, blocked: blocked.length }) : null;
  if (!body?.id || !s)
    return (
      <p className="pt-10 text-base text-ink-2">
        No sheet yet: this ask hasn&apos;t been run, or its answer was blocked. <Link href={`/ask/${id}${typeof sp.t === "string" ? `?t=${encodeURIComponent(sp.t)}` : ""}`} className={btnQuiet}>Open the ask</Link>
      </p>
    );
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

      <section className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-display text-base">{s.heading}</h2>
          {s.tiedNote && <p className="text-ink-2">{s.tiedNote}</p>}
          <ol className="mt-2 space-y-1.5">
            {s.calls.map((c, i) => (
              <li key={c.name + i}>
                <span className="font-semibold">{s.tiedNote ? "" : `${i + 1}. `}{c.name}.</span> {c.reason}{fn(c.steps)}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-ink-2">{s.doubles}{s.doublesStep ? fn([s.doublesStep]) : null}</p>
        </div>
        {s.map && (
          <figure className="w-[2.6in] print:w-[2.2in]">
            {cells && <CollisionMap cells={cells.cells} metrosA={cells.metrosA} metrosB={cells.metrosB} a={s.map.seed.name} b={s.map.rival.name} />}
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
        <p className="mt-1">{s.blocked}</p>
        <p className="mt-1 text-ink-3">{s.credit} crossover-henna.vercel.app/ask/{body.id}</p>
      </footer>
    </article>
  );
}
