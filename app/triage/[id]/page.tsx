import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isEntityType } from "@/lib/slate.ts";
import { parseNames } from "@/lib/triage.ts";
import TriageView from "../triage-view";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const metadata: Metadata = { title: "Inbound triage", robots: { index: false, follow: false } };

// Shareable triage: /triage/<seed id>?t=<type>&n=<id>:<type>,... (proxy.ts already 404s a malformed one before render).
export default function SharedTriage({ params, searchParams }: PageProps<"/triage/[id]">) {
  return (
    <Suspense fallback={<TriageView />}>
      <Gate params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ params, searchParams }: Pick<PageProps<"/triage/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const q = await searchParams;
  const t = typeof q.t === "string" ? q.t : null;
  const names = parseNames(typeof q.n === "string" ? q.n : null);
  if (!UUID.test(id) || !isEntityType(t) || !names) notFound();
  return <TriageView initial={{ seed: { id, type: t }, names }} />;
}
