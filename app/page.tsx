import { Suspense } from "react";
import { connection } from "next/server";
import { SiteHeader } from "@/app/ui";
import { peekAsk } from "@/lib/ask/agent.ts";
import { whereToStart } from "@/lib/ask/where.ts";
import { bothWays } from "@/lib/ask/both-ways.ts";
import { fieldNotesFor } from "@/lib/ask/field-notes.ts";
import { PREPARED_ASKS } from "@/lib/ask/prepared.ts";
import { PROOF } from "@/lib/ask/proof.ts";
import AskView from "./ask/ask-view";
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
    </main>
  );
}

async function Replay() {
  await connection(); // request time: the cache read must not run in the prerender
  const first = PREPARED_ASKS[0];
  const events = await peekAsk(first.body).catch(() => null);
  // the card's where line, the both-ways table and the field notes in the first HTML, so nothing lands after paint and
  // moves the call column mid-replay (MO F6, FIX-F3). ip null: cache reads only, never a Qloo call; a cold cache leaves
  // each to the client's fetch.
  const [where, both, notes] = events
    ? await Promise.all([whereToStart(events, null).catch(() => null), bothWays(events, null).catch(() => null), fieldNotesFor(events, null).catch(() => null)])
    : [null, null, null];
  return <AskView proof={PROOF} play initial={events ? { label: first.label, events, asked: first.body, where: where?.line ?? undefined, both, notes } : undefined} />;
}
