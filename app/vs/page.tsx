import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Skeleton } from "@/app/brief-panel";
import { SiteHeader } from "@/app/ui";
import { peekVs, toPayload } from "@/lib/rivals.ts";
import { VS_CASES } from "@/lib/rivals-cases.ts";
import Front from "./front";

// Two names in (the front door until Pick A, Oct 13): the rivals map, first prepared pair from the cache only (the
// server never spends here; a cold first pair loads in the browser).
export const metadata: Metadata = { title: "Two names in | Crossover" };

export default function Vs() {
  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
      <SiteHeader href="/" label="Ask" />
      <Suspense fallback={<Skeleton lines={8} />}>
        <Hero />
      </Suspense>
    </main>
  );
}

async function Hero() {
  await connection(); // request time: the cache read must not run in the prerender
  const { a, b } = VS_CASES[0];
  const warm = await peekVs(a, b).catch(() => null);
  return <Front initial={{ a, b, payload: warm && warm !== "cold" ? toPayload(warm) : null }} />;
}
