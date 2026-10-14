import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { SiteHeader, btnQuiet } from "@/app/ui";
import { peekAsk } from "@/lib/ask/agent.ts";
import { PREPARED_ASKS } from "@/lib/ask/prepared.ts";
import { replayLine } from "@/lib/ask/steps.ts";
import replay from "@/audit/replay.json";
import replayV2 from "@/audit/replay-v2.json";
import AskView from "./ask/ask-view";

export const PROOF = replayLine(replay.summary!, replayV2.summary!);
import HashRedirect from "./hash-redirect";

// The front door (Pick A, Oct 13): one name in, the agent decides who to call first. The first prepared ask replays
// from the cache on the server (never a Qloo call or a generation here); a cold cache leaves the page waiting for a
// click. Old Pick three links (/?c=, /?s=) redirect to /pick-three (next.config.ts); old anchors in HashRedirect.
export default function Home() {
  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
      <HashRedirect />
      <SiteHeader />
      <Suspense fallback={<AskView proof={PROOF} />}>
        <Replay />
      </Suspense>
      <footer className="mt-16 border-t border-rule pt-6 text-base">
        <p className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/audit" className={btnQuiet}>Is any of this right? The audit</Link>
          <Link href="/vs" className={btnQuiet}>Two names in: where audiences split</Link>
        </p>
      </footer>
    </main>
  );
}

async function Replay() {
  await connection(); // request time: the cache read must not run in the prerender
  const first = PREPARED_ASKS[0];
  const events = await peekAsk(first.body).catch(() => null);
  return <AskView proof={PROOF} initial={events ? { label: first.label, events } : undefined} />;
}
