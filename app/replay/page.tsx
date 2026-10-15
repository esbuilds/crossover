import type { Metadata } from "next";
import { SiteHeader } from "@/app/ui";
import { CHALLENGE, PROTOCOL } from "@/lib/replay-challenge.ts";
import Challenge from "./challenge";

// The replay challenge (Fable's re-judge ruling, real Oct 15): the 23 frozen replay cases, guess then reveal. The
// homepage stays the ask; this is its own route. Built from the audit files at build time: 0 Qloo and 0 model calls.
export const metadata: Metadata = { title: "Spot the real partner", description: "23 real brand collaborations, each hidden among seven decoys. Pick the real partner, then see where Qloo's taste data put it." };

export default function ReplayPage() {
  const p = { v1: { hits: PROTOCOL.v1.hits, scored: PROTOCOL.v1.scored, need: PROTOCOL.v1.need }, v2: { hits: PROTOCOL.v2.hits, scored: PROTOCOL.v2.scored, need: PROTOCOL.v2.need } };
  return (
    <main className="mx-auto max-w-[760px] px-4 pb-24 sm:px-8">
      <SiteHeader href="/" label="Ask" />
      <section className="pt-8">
        <h1 className="font-display text-2xl sm:text-3xl">Spot the real partner</h1>
        <p className="mt-2 max-w-[60ch] text-base text-ink-2">
          {CHALLENGE.length} real brand collaborations, each with a public source. The real partner hides among seven decoys from its own Qloo category and fame band, listed alphabetically with no mark. Pick one, then see where the seed&apos;s fans put it in Qloo&apos;s taste data.
        </p>
      </section>
      <Challenge cases={CHALLENGE} protocol={p} />
    </main>
  );
}
