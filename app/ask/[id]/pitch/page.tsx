import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { PerRequest } from "@/app/dynamic";
import { linkInline, panelStrong } from "@/app/ui";
import PrintButton from "../sheet/print-button";
import { peekAsk } from "@/lib/ask/agent.ts";
import { bodyFromParams } from "@/lib/ask/body.ts";
import { PROOF } from "@/lib/ask/proof.ts";
import blocked from "@/lib/ask/blocked.json";
import { claimCount } from "@/lib/ask/check.ts";
import { whereToStart } from "@/lib/ask/where.ts";
import { bothWays } from "@/lib/ask/both-ways.ts";
import { pitchModel } from "@/lib/ask/pitch.ts";
import { PITCH_CAPTION, PITCH_WHO } from "@/lib/ask/pitch-rules.ts";
import { BothSlope, BothTable } from "../../both-table";
import { FoolIt } from "../../fool-it";

// The pitch sheet (W2, real Oct 24): /ask/<id>/pitch?t=<type>. The call sheet's both-ways rows read down the right
// column, for the seller. One printed page from a cached ask only, as the call sheet; the line is code over the table's
// cells and the review score, checked by the frozen checker with the rows appended as one cited step (lib/ask/pitch.ts).
export const metadata: Metadata = { title: "Pitch sheet", robots: { index: false, follow: false } };

export default function PitchPage({ params, searchParams }: PageProps<"/ask/[id]/pitch">) {
  return (
    <>
      <PerRequest />
      <main className="mx-auto max-w-[7.5in] px-4 pb-16 text-ink print:max-w-none print:px-0 print:pb-0">
        <Suspense fallback={<p className="pt-10 text-base text-ink-2">Reading the cached ask...</p>}>
          <Pitch params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Pitch({ params, searchParams }: Pick<PageProps<"/ask/[id]/pitch">, "params" | "searchParams">) {
  await connection();
  const [{ id }, sp] = [await params, await searchParams];
  const body = bodyFromParams(id, sp);
  const cached = body ? await peekAsk(body).catch(() => null) : null;
  const seedId = (cached?.find((e) => e.type === "result" && e.n === 1) as { output?: { id?: string } } | undefined)?.output?.id;
  const events = cached && seedId?.toUpperCase() === id.toUpperCase() ? cached : null;
  const both = events ? await bothWays(events, null).catch(() => null) : null; // cache only
  const p = events ? pitchModel(events, both) : null;
  const back = `/ask/${id}?${new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"))}`;
  if (!body || !p || !both)
    return (
      <p className="pt-10 text-base text-ink-2">
        No pitch sheet for this ask: it needs a cached answer and a both-ways table. <Link href={back} className={linkInline}>Open the ask</Link>
      </p>
    );
  const where = await whereToStart(events!, null, p.pick).catch(() => null); // cache only; pitch-warm.ts fills it once
  const fn = (ns: number[]) => <sup className="ml-0.5 font-mono text-[0.7em] text-ink-3">[{ns.join(",")}]</sup>;
  const [call] = p.decision.calls;

  return (
    <article className="pt-6 text-[13px] leading-snug print:pt-0 print:text-[10px]">
      <header className="flex items-baseline justify-between border-b border-rule-strong pb-2">
        <p className="font-display text-lg">Crossover · pitch sheet</p>
        <p className="print:hidden"><PrintButton /></p>
      </header>
      <h1 className="mt-3 font-display text-2xl">{p.question}</h1>
      <div className={`${panelStrong} mt-2 px-3 py-2`}>
        <p className="text-base font-semibold">Pitch first: {p.pick}</p>
        <p className="text-ink-2">{p.card}</p>
        <p className="mt-1 font-mono text-[0.9em] text-ink-3">{claimCount(p.decision)} names and numbers checked, each matched to the step it cites</p>
      </div>

      <section className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-semibold text-ink-2">The line for the call</h2>
          <p className="text-base text-ink">{p.line}{fn(call.steps)}</p>
          <div className="print:hidden"><FoolIt decision={p.decision} steps={p.steps} /></div>
          {p.caution && <p className="mt-2 text-ink-2">{p.caution}{fn(p.decision.cautions[0].steps)}</p>}
          <p className="mt-1.5 text-ink-2">{p.summary}{fn(p.decision.summary[0].steps)}</p>
          <p className="mt-2 text-ink-3">{PITCH_CAPTION}</p>
          <BothTable b={both} compact lead={p.pick} />
          {where?.line && (
            <>
              <h2 className="mt-2 font-semibold text-ink-2">Where to pitch it</h2>
              <p className="text-ink-2">{where.line}</p>
            </>
          )}
        </div>
        {/* the same rows drawn, screen only as on the call sheet */}
        <div className="w-full sm:w-[2.6in] print:hidden"><BothSlope b={both} column lead={p.pick} /></div>
      </section>

      <section className="mt-3 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <div>
          <h2 className="text-base font-semibold">Steps (each measured in Qloo)</h2>
          <ol className="mt-1 space-y-0.5 text-ink-2">
            {p.footnotes.map((f) => <li key={f.n}><span className="font-mono text-ink-3">{f.n}</span> {f.label}: {f.summary}</li>)}
          </ol>
        </div>
        <div>
          <h2 className="text-base font-semibold">What this doesn&apos;t establish</h2>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-2">
            {p.limits.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
      </section>

      <footer className="mt-3 border-t border-rule pt-2 text-ink-2">
        <p>{PROOF}</p>
        <p className="mt-1">{PITCH_WHO}</p>
        <p className="mt-1">Blocked by the checker under its current rule: {blocked.filter((b) => b.underV2 !== "passes").length} answers, each listed on /audit with the rule that blocked it.</p>
        <p className="mt-1 text-ink-3">Data: Qloo. Drawn by code. Every number cites a step. crossover-henna.vercel.app/ask/{id.toUpperCase()}/pitch · printed {new Date().toISOString().slice(0, 10)}</p>
      </footer>
    </article>
  );
}
