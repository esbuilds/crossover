import { Suspense } from "react";
import { PerRequest } from "@/app/dynamic";
import { notFound } from "next/navigation";
import PairView from "../../pair-view";
import type { Metadata } from "next";
import { isEntityType, peekCard } from "@/lib/slate.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shareable pairing: /pair/<idA>/<idB>?ta=<type>&tb=<type>. Checked here before any Qloo call; anything else 404s.
export async function generateMetadata({ params, searchParams }: PageProps<"/pair/[a]/[b]">): Promise<Metadata> {
  const { a, b } = await params;
  const q = await searchParams;
  const [ca, cb] = await Promise.all([peekCard(a, String(q.ta ?? "")).catch(() => null), peekCard(b, String(q.tb ?? "")).catch(() => null)]);
  return { title: ca && cb ? `${ca.name} \u00d7 ${cb.name}` : "Check a pairing" };
}

export default function SharedPair({ params, searchParams }: PageProps<"/pair/[a]/[b]">) {
  return (
    <>
      <PerRequest />
      <Suspense fallback={<PairView />}>
        <Gate params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Gate({ params, searchParams }: Pick<PageProps<"/pair/[a]/[b]">, "params" | "searchParams">) {
  const { a, b } = await params;
  const q = await searchParams;
  const ta = typeof q.ta === "string" ? q.ta : null;
  const tb = typeof q.tb === "string" ? q.tb : null;
  if (!UUID.test(a) || !UUID.test(b) || a === b || !isEntityType(ta) || !isEntityType(tb)) notFound();
  return <PairView initial={{ a, b, ta, tb }} />;
}
