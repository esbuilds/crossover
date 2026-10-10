import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PerRequest } from "@/app/dynamic";
import { parseShare, shareCard, shareQuery } from "@/lib/review-share.ts";
import ReviewView from "./review/review-view";

// The front door (Oct 10): Pick three. A share link (/?c=...&p=... or /?s=...&n=...) opens straight on its reveal;
// its title and card come from the query alone. The partner search moved to /find.
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
      <Suspense fallback={<ReviewView />}>
        <Gate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  return <ReviewView initial={parseShare(await searchParams) ?? undefined} />;
}
