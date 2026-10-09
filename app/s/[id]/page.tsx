import { Suspense } from "react";
import { PerRequest } from "@/app/dynamic";
import { notFound } from "next/navigation";
import Crossover from "../../crossover";
import type { Metadata } from "next";
import { isEntityType, peekCard } from "@/lib/slate.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shareable link: /s/<qloo entity id>?t=<urn:entity:type>[&c=<refine constraints>]. The id shape and type are
// checked here, before any Qloo call; anything else is a 404.
// Title and preview card from the cache only, so a crawler never spends a Qloo call.
export async function generateMetadata({ params, searchParams }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  const q = await searchParams;
  const t = typeof q.t === "string" ? q.t : "";
  if (!UUID.test(id) || !isEntityType(t)) return {};
  const card = await peekCard(id, t).catch(() => null);
  const title = card ? `Partners for ${card.name}` : "Partners";
  const image = `/s/${id}/og?t=${encodeURIComponent(t)}`;
  return { title, openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default function Shared({ params, searchParams }: PageProps<"/s/[id]">) {
  return (
    <>
      <PerRequest />
      <Suspense fallback={<Crossover />}>
        <Gate params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Gate({ params, searchParams }: Pick<PageProps<"/s/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const q = await searchParams;
  const t = typeof q.t === "string" ? q.t : null;
  const c = typeof q.c === "string" ? q.c.slice(0, 200) : undefined;
  if (!UUID.test(id) || !isEntityType(t)) notFound();
  return <Crossover initialId={id} initialType={t} initialConstraints={c} />;
}
