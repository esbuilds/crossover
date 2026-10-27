import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PerRequest } from "@/app/dynamic";
import { SiteHeader, shell } from "@/app/ui";
import { parseShare, shareCard, shareQuery } from "@/lib/review-share.ts";
import ReviewView from "../review/review-view";

// Pick three (its own route since Oct 13; it sat below the rivals front door before). Share links
// (/pick-three?c=... or ?s=...&n=...) open on their reveal, with the title and card from the query alone.
export async function generateMetadata({ searchParams }: PageProps<"/pick-three">): Promise<Metadata> {
  await connection();
  const s = parseShare(await searchParams);
  if (!s) return { title: "Pick three" }; // the layout's template adds "| Crossover"
  const { title } = shareCard(s);
  const image = `/og?${shareQuery(s)}`;
  return { title, openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default function PickThree({ searchParams }: PageProps<"/pick-three">) {
  return (
    <>
      <PerRequest />
      <main className={shell}>
        <SiteHeader href="/" label="Ask" />
        <Suspense fallback={<ReviewView embedded />}>
          <Gate searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/pick-three">, "searchParams">) {
  return <ReviewView embedded initial={parseShare(await searchParams) ?? undefined} />;
}
