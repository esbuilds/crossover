import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PerRequest } from "@/app/dynamic";
import { Skeleton } from "@/app/brief-panel";
import { SiteHeader } from "@/app/ui";
import { parseShare, shareCard, shareQuery } from "@/lib/review-share.ts";
import { peekVs, toPayload } from "@/lib/rivals.ts";
import { VS_CASES } from "@/lib/rivals-cases.ts";
import ReviewView from "./review/review-view";
import Front from "./vs/front";

// The front door (brief-oct12-front): the rivals map, first prepared pair from the cache only (the server never spends
// here; a cold first pair loads in the browser). Pick three sits below, unchanged; its share links (/?c=...&p=... or
// /?s=...&n=...) still open on their reveal, with the title and card from the query alone. The search lives at /find.
export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  await connection();
  const s = parseShare(await searchParams);
  if (!s) return {};
  const { title } = shareCard(s);
  const image = `/og?${shareQuery(s)}`;
  return { title, openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PerRequest />
      <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
        <SiteHeader href="/find" label="Find more partners" />
        <Suspense fallback={<Skeleton lines={8} />}>
          <Hero />
        </Suspense>
        <Suspense fallback={<ReviewView embedded />}>
          <Gate searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Hero() {
  await connection(); // request time: the cache read must not run in the prerender
  const { a, b } = VS_CASES[0];
  const warm = await peekVs(a, b).catch(() => null);
  return <Front initial={{ a, b, payload: warm && warm !== "cold" ? toPayload(warm) : null }} />;
}

async function Gate({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  return <ReviewView embedded initial={parseShare(await searchParams) ?? undefined} />;
}
