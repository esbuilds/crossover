import { ogCard, ogMapCard } from "@/lib/og.tsx";
import { getConstellation } from "@/lib/constellation.ts";
import { constellationCard } from "@/lib/constellation-layout.ts";
import { getLeaders } from "@/lib/leaders.ts";
import { leadersSvg } from "@/lib/og-map.ts";
import { LEADER_TONE } from "@/lib/leader-tones.ts";

// GET /map/<slug>/og: the aisle's share card, cache only (a crawler never spends a Qloo call). An aisle with a leaders
// map shows it (round 3 pick 2); otherwise the constellation; cold or unknown gets the text card.
export async function GET(_request: Request, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const l = await getLeaders(category, true).catch(() => null);
  const c = l && l !== "cold" ? null : await getConstellation(category, true).catch(() => null);
  const res =
    l && l !== "cold"
      ? await ogMapCard({
          title: `${l.title}: who leads each city`,
          line: `Ranked within the ${l.common.toLocaleString("en-US")} cells where all three have a reading`,
          svg: leadersSvg(l.cells, LEADER_TONE),
          legend: l.brands.map((b, k) => ({ color: LEADER_TONE[k], label: `${b.name} leads ${b.cells.toLocaleString("en-US")}` })),
        })
      : c && c !== "cold"
        ? await ogMapCard({ title: c.title, line: "Who sits near whom, by mutual audience affinity in Qloo", ...constellationCard(c), legend: [] })
        : await ogCard({ title: "Who sits near whom", line: "A category's brands by audience affinity" });
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  return res;
}
