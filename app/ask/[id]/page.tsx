import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PerRequest } from "@/app/dynamic";
import { SiteHeader, shell } from "@/app/ui";
import { peekAsk, type AskEvent } from "@/lib/ask/agent.ts";
import { bodyFromParams } from "@/lib/ask/body.ts";
import { PROOF } from "@/lib/ask/proof.ts";
import { REPLAY_ASK, UNNAMED_ASK } from "@/lib/ask/prepared.ts";
import { peekCard } from "@/lib/slate.ts";
import { whereToStart } from "@/lib/ask/where.ts";
import { bothWays } from "@/lib/ask/both-ways.ts";
import { fieldNotesFor } from "@/lib/ask/field-notes.ts";
import AskView from "../ask-view";

// A shared ask: /ask/<Qloo id>?t=<entity type>. A cached ask replays (no Qloo call, no generation); one that isn't
// cached waits for a click on its chip, so crawlers and link previews never spend.
async function load(params: Promise<{ id: string }>, searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const [{ id }, sp] = [await params, await searchParams];
  // ?q= a typed name, ?case= the replay case, else the id (lib/ask/body.ts bodyFromParams)
  const body = bodyFromParams(id, sp);
  if (!body) return null;
  const events = await peekAsk(body).catch(() => null);
  const seed = events?.find((e): e is Extract<AskEvent, { type: "result" }> => e.type === "result" && e.n === 1)?.output as { name?: string; id?: string } | undefined;
  // a cached ask must have resolved to the link's id, so a link can't relabel another name's answer
  const ok = !!events && seed?.id?.toUpperCase() === id.toUpperCase();
  return { id: id.toUpperCase(), type: typeof sp.t === "string" ? sp.t : "urn:entity:brand", body, events: ok ? events : null, seed: ok ? (seed?.name ?? null) : null };
}

export async function generateMetadata({ params, searchParams }: PageProps<"/ask/[id]">): Promise<Metadata> {
  await connection();
  const r = await load(params, searchParams);
  if (!r?.seed) return { title: "Who should they call first?" };
  const title = `Who should ${r.seed} call first?`;
  const image = `/ask/${r.id}/og?t=${encodeURIComponent(r.type)}`;
  return { title, openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default function SharedAsk({ params, searchParams }: PageProps<"/ask/[id]">) {
  return (
    <>
      <PerRequest />
      <main className={shell}>
        <SiteHeader href="/" label="Ask" />
        <Suspense fallback={<AskView />}>
          <Shared params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Shared({ params, searchParams }: Pick<PageProps<"/ask/[id]">, "params" | "searchParams">) {
  await connection(); // request time: the cache reads below must not run in the prerender (they read the clock)
  const r = await load(params, searchParams);
  if (!r) notFound(); // an id that isn't a Qloo id is a broken link, as on /s (FIX-F6), not a blank ask page
  const asked = "query" in r.body && r.body.query ? { query: r.body.query } : r.body.caseKey ? { case: r.body.caseKey } : { id: r.id, type: r.type };
  if (!r.events || !r.seed) {
    // the name for the chip (FIX-F7): the typed name, the replay case's label, or the cached card's name; cache only
    const label = "query" in asked ? asked.query ?? UNNAMED_ASK : "case" in asked ? REPLAY_ASK.label : (await peekCard(r.id, r.type).catch(() => null))?.name ?? UNNAMED_ASK;
    return <AskView proof={PROOF} pending={{ label, body: asked }} />;
  }
  // the where line, both-ways table and field notes from the cache on the server (MO F6, FIX-F3): nothing lands late
  const [where, both, notes] = await Promise.all([whereToStart(r.events, null).catch(() => null), bothWays(r.events, null).catch(() => null), fieldNotesFor(r.events, null).catch(() => null)]);
  return <AskView proof={PROOF} initial={{ label: r.seed, events: r.events, asked, where: where?.line ?? undefined, both, notes }} />;
}
