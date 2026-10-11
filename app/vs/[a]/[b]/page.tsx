import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { PerRequest } from "@/app/dynamic";
import { Skeleton } from "@/app/brief-panel";
import { SiteHeader } from "@/app/ui";
import { QuotaError } from "@/lib/qloo.ts";
import { isEntityType, peekCard } from "@/lib/slate.ts";
import { generationKey } from "@/lib/agent/stream-cache.ts";
import { failCode } from "@/lib/failure.ts";
import { FAIL_COPY } from "@/lib/fail-copy.ts";
import { ColdPairCap, loadVs, toPayload, type VsData } from "@/lib/rivals.ts";
import Front from "../../front";

// Rivals deep link and share link: /vs/<idA>/<idB>?ta=<type>&tb=<type>. The front door with this pair loaded. Ids
// only; the shape is checked in proxy.ts (real 404) and again here. A cold pair counts against the visitor's ten.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params, searchParams }: PageProps<"/vs/[a]/[b]">): Promise<Metadata> {
  await connection();
  const { a, b } = await params;
  const q = await searchParams;
  const [ca, cb] = await Promise.all([peekCard(a.toUpperCase(), String(q.ta ?? "")).catch(() => null), peekCard(b.toUpperCase(), String(q.tb ?? "")).catch(() => null)]);
  if (!ca || !cb) return { title: "Rivals", robots: { index: false } };
  const title = `${ca.name} vs ${cb.name}`;
  const image = `/vs/${a}/${b}/og?ta=${encodeURIComponent(ca.type)}&tb=${encodeURIComponent(cb.type)}`;
  return { title, openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default function VsPage({ params, searchParams }: PageProps<"/vs/[a]/[b]">) {
  return (
    <>
      <PerRequest />
      <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
        <SiteHeader href="/find" label="Find more partners" />
        <Suspense fallback={<Skeleton lines={8} />}>
          <Body params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Body({ params, searchParams }: Pick<PageProps<"/vs/[a]/[b]">, "params" | "searchParams">) {
  const { a, b } = await params;
  const q = await searchParams;
  const ta = typeof q.ta === "string" ? q.ta : null;
  const tb = typeof q.tb === "string" ? q.tb : null;
  if (!UUID.test(a) || !UUID.test(b) || a.toUpperCase() === b.toUpperCase() || !isEntityType(ta) || !isEntityType(tb)) notFound();
  let data: VsData | null;
  try {
    data = await loadVs({ id: a, type: ta }, { id: b, type: tb }, generationKey(new Request("http://vs", { headers: await headers() })));
  } catch (err) {
    console.error("[vs]", err);
    const code = failCode(err);
    const error =
      err instanceof ColdPairCap ? "That's ten new pairs today. The prepared pairs still work." : code ? FAIL_COPY[code] : err instanceof QuotaError ? "Qloo's taste data is busy right now. The prepared pairs still work." : "Qloo didn't answer. The prepared pairs still work.";
    return <Front initial={{ a: { id: a, name: "", type: ta }, b: { id: b, name: "", type: tb }, payload: null, error }} />;
  }
  if (!data) notFound();
  const side = (e: VsData["a"], type: string) => ({ id: e.entity_id, name: e.name, type });
  return <Front initial={{ a: side(data.a, ta), b: side(data.b, tb), payload: toPayload(data) }} />;
}
