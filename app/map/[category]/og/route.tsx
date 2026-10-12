import { ogCard, ogMapCard } from "@/lib/og.tsx";
import { getConstellation } from "@/lib/constellation.ts";
import { constellationCard } from "@/lib/constellation-layout.ts";

// GET /map/<slug>/og: the share card is the constellation (brief-oct13-moonshots day 3). Cache only: a crawler never
// spends a Qloo call. A cold or unknown category gets the text card.
export async function GET(_request: Request, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const c = await getConstellation(category, true).catch(() => null);
  const res =
    c && c !== "cold"
      ? await ogMapCard({ title: c.title, line: "Who sits near whom, by mutual audience affinity in Qloo", ...constellationCard(c), legend: [] })
      : await ogCard({ title: "Who sits near whom", line: "A category's brands by audience affinity" });
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  return res;
}
