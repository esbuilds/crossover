import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PerRequest } from "@/app/dynamic";
import { SiteHeader, shell } from "@/app/ui";
import { peekAsk, type AskEvent } from "@/lib/ask/agent.ts";
import { bodyFromParams } from "@/lib/ask/body.ts";
import { PROOF } from "@/lib/ask/proof.ts";
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
  if (!r?.seed) return { title: "Who should they call first? | Crossover" };
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
  const r = await load(params, searchParams);
  if (!r) return <AskView />;
  const asked = "query" in r.body && r.body.query ? { query: r.body.query } : r.body.caseKey ? { case: r.body.caseKey } : { id: r.id, type: r.type };
  return r.events && r.seed ? <AskView proof={PROOF} initial={{ label: r.seed, events: r.events, asked }} /> : <AskView proof={PROOF} pending={{ label: "This ask", body: asked }} />;
}
