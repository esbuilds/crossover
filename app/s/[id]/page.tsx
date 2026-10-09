import { Suspense } from "react";
import { notFound } from "next/navigation";
import Crossover from "../../crossover";
import { isEntityType } from "@/lib/slate.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shareable link: /s/<qloo entity id>?t=<urn:entity:type>[&c=<refine constraints>]. The id shape and type are
// checked here, before any Qloo call; anything else is a 404.
export default function Shared({ params, searchParams }: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<Crossover />}>
      <Gate params={params} searchParams={searchParams} />
    </Suspense>
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
