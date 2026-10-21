import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { Metadata } from "next";
import { PerRequest } from "@/app/dynamic";
import { Skeleton } from "@/app/brief-panel";
import { SiteHeader, shell } from "@/app/ui";
import { CATEGORIES, getConstellation } from "@/lib/constellation.ts";
import ConstellationView from "../constellation-view";
import LeadersMap from "../leaders-map";
import { getLeaders, type Leaders } from "@/lib/leaders.ts";
import { LEADER_TONE } from "@/lib/leader-tones.ts";

// Category constellation (brief-oct13-moonshots pick 1): /map/<slug> for the three prepared categories. Warm: 0 calls.
// Cold (only before the warm script ran): one scoring call per brand but the last, cached for good after.

export async function generateMetadata({ params }: PageProps<"/map/[category]">): Promise<Metadata> {
  await connection();
  const { category } = await params;
  const cat = CATEGORIES.find((c) => c.slug === category);
  if (!cat) return { title: "Category map" };
  const title = `${cat.title}: who sits near whom`;
  const image = `/map/${cat.slug}/og`;
  return { title, openGraph: { title, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default function MapPage({ params }: PageProps<"/map/[category]">) {
  return (
    <>
      <PerRequest />
      <main className={shell}>
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
  if (c === "cold" || c === "failed") return <p className="pt-page text-lg text-ink">Qloo didn&apos;t answer. The rivals pairs still work.</p>;
  const leaders = await getLeaders(category).catch((err) => (console.error("[leaders]", err), null));
  return (
    <>
      <section className="pt-page">
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

      {leaders && leaders !== "cold" && <LeadersSection l={leaders} />}

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
          Each brand but the last was scored against all the others in one Qloo call ({c.calls} calls, cached). Same-type affinity in Qloo is symmetric, so where a pair has two readings (one from each call) its number is their mean. Distance is 1 minus affinity, projected to two dimensions by classical multidimensional scaling in code; no model is involved. Projection stress {c.stress.toFixed(2)} (0 would be exact).
          {c.filled > 0 && ` ${c.filled} pairs had no reading and sit at the average distance.`} Qloo&apos;s fallback values are never used.
        </p>
      </details>
    </>
  );
}

function LeadersSection({ l }: { l: Leaders }) {
  const names = l.brands.map((b) => b.name);
  return (
    <section className="mt-8 border-t border-rule pt-6">
      <h2 className="font-display text-xl sm:text-2xl">Who leads each city: {names.slice(0, -1).join(", ")} and {names.at(-1)}</h2>
      <p className="mt-2 max-w-[68ch] text-base text-ink-2">
        Ranked within the {l.common.toLocaleString("en-US")} cells where all three have a reading; blank elsewhere. Leads means over-indexes most relative to its own national pattern, not the most fans.
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start">
        <div>
          <LeadersMap cells={l.cells} names={names} />
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
            {l.brands.map((b, k) => (
              <span key={b.id} className="inline-flex items-center gap-2">
                <span className="inline-block size-3 rounded-full" style={{ background: LEADER_TONE[k] }} />
                {b.name}: leads {b.cells.toLocaleString("en-US")} cells
              </span>
            ))}
          </p>
        </div>
        <table className="w-full text-left text-base">
          <caption className="pb-2 text-left text-sm text-ink-3">The twelve markets with the most coloured cells</caption>
          <thead className="text-sm text-ink-3">
            <tr>
              <th className="py-1 pr-3 font-normal">Market</th>
              <th className="py-1 font-normal">Leads there</th>
            </tr>
          </thead>
          <tbody>
            {l.markets.map((m) => (
              <tr key={m.name} className="border-t border-rule">
                <td className="py-1.5 pr-3 text-ink">{m.name}</td>
                <td className="py-1.5 text-ink-2">
                  <span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: LEADER_TONE[m.leader] }} />
                  {names[m.leader]} <span className="text-sm text-ink-3 tabular-nums">({Math.round(m.share * m.cells)} of {m.cells} cells)</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-3 max-w-[68ch] text-sm text-ink-2">
        <summary className="cursor-pointer text-base">How the leaders map was made</summary>
        <p className="mt-2">
          Each brand&apos;s national Qloo heatmap, re-ranked by percentile within the cells all three carry, as the pair map does. A cell goes to the brand with the highest percentile there and stays blank when none reaches its own top half. {Math.round(l.region * 100)} of every 100 coloured cells share their leader with most of their neighbours, so these are regions, not scattered points. Three brands, not the whole aisle: with all nine, the brands with the biggest maps decide most cells (see /audit).{l.why ? ` ${l.why}` : ""}
        </p>
      </details>
    </section>
  );
}
