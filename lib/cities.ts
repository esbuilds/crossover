// Heatmap to launch cities (PLAN.md section 3). The locality boundary 500s on the hackathon host,
// so geohash cells are aggregated to a static table of 60 US metros.
import metros from "../data/metros.json" with { type: "json" };
import { heatmap, type HeatCell } from "./qloo.ts";

export type City = { name: string; lat: number; lon: number; score: number; cells: number };
export type Cities = { top: City[]; cells: Omit<HeatCell, "affinity_rank">[] };

const RADIUS_KM = 40;
const MIN_POPULAR_CELLS = 2; // cells with popularity above 0.5; keeps empty desert cells from crowning a metro

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

export function rankMetros(cells: HeatCell[]): City[] {
  const buckets = metros.map(() => [] as HeatCell[]);
  for (const c of cells) {
    // ponytail: 60 x 11k distance checks, about 1 ms. A spatial index is pointless at this size.
    let best = -1;
    let bestKm = RADIUS_KM;
    metros.forEach((m, i) => {
      const d = km(c.lat, c.lon, m.lat, m.lon);
      if (d <= bestKm) [best, bestKm] = [i, d];
    });
    if (best >= 0) buckets[best].push(c);
  }
  return metros
    .map((m, i) => {
      const b = buckets[i];
      const score = b.reduce((s, c) => s + c.affinity_rank, 0) / (b.length || 1);
      return { ...m, score: Math.round(score * 1000) / 1000, cells: b.length, popular: b.filter((c) => c.popularity > 0.5).length };
    })
    .filter((m) => m.popular >= MIN_POPULAR_CELLS)
    .sort((a, b) => b.score - a.score)
    .map(({ popular: _, ...m }) => m); // eslint-disable-line @typescript-eslint/no-unused-vars
}

export async function getCities(entityId: string): Promise<Cities> {
  const cells = await heatmap(entityId, "United States");
  return {
    top: rankMetros(cells).slice(0, 10),
    cells: cells.map(({ lat, lon, affinity, popularity }) => ({ lat, lon, affinity, popularity })),
  };
}
