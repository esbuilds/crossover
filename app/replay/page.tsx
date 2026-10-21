import type { Metadata } from "next";
import { SiteHeader, shell } from "@/app/ui";
import { CHALLENGE, PROTOCOL } from "@/lib/replay-challenge.ts";
import Challenge from "./challenge";
import { StripImage } from "./strip-image";
import control from "@/audit/replay-control.json";
import { replayLine } from "@/lib/replay-control.ts";

// The replay challenge (Fable's re-judge ruling, real Oct 15): the 23 frozen replay cases, guess then reveal. The
// homepage stays the ask; this is its own route. Built from the audit files at build time: 0 Qloo and 0 model calls.
export const metadata: Metadata = { title: "Spot the real partner", description: "23 real brand collaborations, each hidden among seven decoys. Pick the real partner, then see where Qloo's taste data put it." };

export default function ReplayPage() {
  const p = { v1: { hits: PROTOCOL.v1.hits, scored: PROTOCOL.v1.scored, need: PROTOCOL.v1.need }, v2: { hits: PROTOCOL.v2.hits, scored: PROTOCOL.v2.scored, need: PROTOCOL.v2.need }, line: replayLine(control) };
  return (
    // the header keeps every other route's 1120 so the wordmark doesn't jump on a nav click; the game keeps 760 (DC F9)
    <main className={shell}>
      <SiteHeader href="/" label="Ask" />
      <div className="max-w-[760px]">
        <section className="pt-page">
          <h1 className="font-display text-2xl sm:text-3xl">Spot the real partner</h1>
          <p className="mt-3 max-w-copy text-lg text-ink-2 sm:mt-4">
            {CHALLENGE.length} real brand collaborations, each with a public source. The real partner hides among seven decoys from its own Qloo category and fame band, listed alphabetically with no mark. Pick one, then see where the seed&apos;s fans put it in Qloo&apos;s taste data.
          </p>
        </section>
        <StripImage className="mt-block" />
        <Challenge cases={CHALLENGE} protocol={p} />
      </div>
    </main>
  );
}
