import { Suspense } from "react";
import { notFound } from "next/navigation";
import PairView from "../../pair-view";
import { isEntityType } from "@/lib/slate.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shareable pairing: /pair/<idA>/<idB>?ta=<type>&tb=<type>. Checked here before any Qloo call; anything else 404s.
export default function SharedPair({ params, searchParams }: PageProps<"/pair/[a]/[b]">) {
  return (
    <Suspense fallback={<PairView />}>
      <Gate params={params} searchParams={searchParams} />
    </Suspense>
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
