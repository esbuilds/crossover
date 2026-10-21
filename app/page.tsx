import { Suspense } from "react";
import { connection } from "next/server";
import { SiteHeader, shell } from "@/app/ui";
import { peekAsk } from "@/lib/ask/agent.ts";
import { whereToStart } from "@/lib/ask/where.ts";
import { PREPARED_ASKS } from "@/lib/ask/prepared.ts";
import { PROOF } from "@/lib/ask/proof.ts";
import AskView from "./ask/ask-view";
import HashRedirect from "./hash-redirect";

// The front door (Pick A, Oct 13): one name in, the agent decides who to call first. The first prepared ask replays
// from the cache on the server (never a Qloo call or a generation here); a cold cache leaves the page waiting for a
// click. Old Pick three links (/?c=, /?s=) redirect to /pick-three (next.config.ts); old anchors in HashRedirect.
export default function Home() {
  return (
    <main className={shell}>
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
  // the card's where line in the first HTML, so the card doesn't grow after paint (MO F6). ip null: a cache read only,
  // never a Qloo call; a cold cache leaves it to the client's fetch.
  const where = events ? await whereToStart(events, null).catch(() => null) : null;
  return <AskView proof={PROOF} play initial={events ? { label: first.label, events, asked: first.body, where: where?.line ?? undefined } : undefined} />;
}
