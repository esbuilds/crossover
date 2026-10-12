import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { Metadata } from "next";
import { PerRequest } from "@/app/dynamic";
import { Skeleton } from "@/app/brief-panel";
import { SiteHeader } from "@/app/ui";
import { CATEGORIES, getConstellation } from "@/lib/constellation.ts";
import ConstellationView from "../constellation-view";

// Category constellation (brief-oct13-moonshots pick 1): /map/<slug> for the three prepared categories. Warm: 0 calls.
// Cold (only before the warm script ran): one scoring call per brand but the last, cached for good after.

export async function generateMetadata({ params }: PageProps<"/map/[category]">): Promise<Metadata> {
  await connection();
  const { category } = await params;
  const cat = CATEGORIES.find((c) => c.slug === category);
  return { title: cat ? `${cat.title}: who sits near whom` : "Category map" };
}

export default function MapPage({ params }: PageProps<"/map/[category]">) {
  return (
    <>
      <PerRequest />
      <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
        <SiteHeader href="/" label="Rivals" />
        <Suspense fallback={<Skeleton lines={8} />}>
          <Body params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Body({ params }: Pick<PageProps<"/map/[category]">, "params">) {
  const { category } = await params;
  const c = await getConstellation(category).catch((err) => (console.error("[map]", err), "failed" as const));
  if (c === null) notFound();
  if (c === "cold" || c === "failed") return <p className="pt-8 text-lg text-ink">Qloo didn&apos;t answer. The rivals pairs still work.</p>;
  return (
    <>
      <section className="pt-8">
        <p className="flex flex-wrap gap-x-4 text-base text-ink-2">
          {CATEGORIES.map((x) => (
            <Link key={x.slug} href={`/map/${x.slug}`} aria-current={x.slug === c.slug ? "page" : undefined} className="min-h-11 content-center underline-offset-4 hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-ink">
              {x.title}
            </Link>
          ))}
        </p>
        <h1 className="mt-4 font-display text-2xl sm:text-3xl">{c.title}: who sits near whom</h1>
        <p className="mt-2 max-w-[68ch] text-base text-ink-2">
          Nearness is mutual affinity between the two audiences in Qloo. The layout is a projection and the distances are approximate; the numbers are in the table. Lines join each brand to its nearest audience and every pair at 0.95 or more; thicker is closer. Bigger dots are better known (Qloo popularity).
        </p>
      </section>

      <ConstellationView c={c} />

      <section className="mt-10">
        <h2 className="font-display text-xl">Nearest three</h2>
        <table className="mt-3 w-full max-w-[760px] text-left text-base">
          <thead className="text-sm text-ink-3">
            <tr>
              <th className="py-1 pr-4 font-normal">Brand</th>
              <th className="py-1 font-normal">Closest audiences (mutual affinity)</th>
            </tr>
          </thead>
          <tbody>
            {c.nearest.map((n) => (
              <tr key={n.name} className="border-t border-rule align-top">
                <td className="py-2 pr-4 text-ink">{n.name}</td>
                <td className="py-2 text-ink-2">{n.near.map((x) => `${x.name} ${x.affinity.toFixed(2)}`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {c.notMeasured.length > 0 && <p className="mt-3 text-base text-ink-2">Not measured: {c.notMeasured.join(", ")}.</p>}
        {c.absent.length > 0 && <p className="mt-2 text-base text-ink-2">Not in Qloo as a brand: {c.absent.join(", ")}.</p>}
      </section>

      <details className="mt-8 max-w-[68ch] text-sm text-ink-2">
        <summary className="cursor-pointer text-base">How this was made</summary>
        <p className="mt-2">
          Each brand but the last was scored against all the others in one Qloo call ({c.calls} calls, cached). Same-type affinity in Qloo is symmetric, so the two readings of a pair are averaged. Distance is 1 minus affinity, projected to two dimensions by classical multidimensional scaling in code; no model is involved. Projection stress {c.stress.toFixed(2)} (0 would be exact).
          {c.filled > 0 && ` ${c.filled} pairs had no reading and sit at the average distance.`} Qloo&apos;s fallback values are never used.
        </p>
      </details>
    </>
  );
}
