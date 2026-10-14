import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PerRequest } from "@/app/dynamic";
import { SiteHeader } from "@/app/ui";
import { peekAsk, type AskEvent } from "@/lib/ask/agent.ts";
import { parseAskBody } from "@/lib/ask/body.ts";
import { PROOF } from "@/app/page";
import AskView from "../ask-view";

// A shared ask: /ask/<Qloo id>?t=<entity type>. A cached ask replays (no Qloo call, no generation); one that isn't
// cached waits for a click on its chip, so crawlers and link previews never spend.
async function load(params: Promise<{ id: string }>, searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const [{ id }, sp] = [await params, await searchParams];
  const parsed = parseAskBody({ id, type: typeof sp.t === "string" ? sp.t : "urn:entity:brand" });
  if (!parsed?.id || !parsed.type) return null;
  const body = { id: parsed.id, type: parsed.type };
  const events = await peekAsk(body).catch(() => null);
  const seed = events?.find((e): e is Extract<AskEvent, { type: "result" }> => e.type === "result" && e.n === 1)?.output as { name?: string } | undefined;
  return { body, events, seed: seed?.name ?? null };
}

export async function generateMetadata({ params, searchParams }: PageProps<"/ask/[id]">): Promise<Metadata> {
  await connection();
  const r = await load(params, searchParams);
  if (!r?.seed) return { title: "Who should they call first? | Crossover" };
  const title = `Who should ${r.seed} call first?`;
  const image = `/ask/${r.body.id}/og?t=${encodeURIComponent(r.body.type)}`;
  return { title, openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default function SharedAsk({ params, searchParams }: PageProps<"/ask/[id]">) {
  return (
    <>
      <PerRequest />
      <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
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
  return r.events && r.seed ? <AskView proof={PROOF} initial={{ label: r.seed, events: r.events }} /> : <AskView proof={PROOF} pending={{ label: "This ask", body: r.body }} />;
}
