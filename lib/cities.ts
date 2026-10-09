// Heatmap to launch cities (PLAN.md section 3). The locality boundary 500s on the hackathon host,
// so geohash cells are aggregated to a static table of US markets, one per market and at least 100 km apart.
// A market can fold in satellite cities ("also"): a cell counts if it's within 40 km of any of its centers.
import markets from "../data/metros.json" with { type: "json" };
import { heatmap, type HeatCell, type Signal } from "./qloo.ts";

// overIndex: metro score / national mean of all cells x 100. 130 reads "30% above the country" (PLAN.md section 8).
export type City = { name: string; state?: string; lat: number; lon: number; score: number; overIndex: number; cells: number };
export type MapCell = [lat: number, lon: number, affinity: number, popularity: number];
export type Cities = { metros: City[]; cells: MapCell[]; cellCount: number; marketCount: number };

type Point = { lat: number; lon: number };
const metros = markets as (Point & { name: string; state: string; also?: (Point & { name: string })[] })[];

const MAP_CELLS = 1500; // the map gets the hottest cells only; ranking still uses all of them

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
    // ponytail: ~65 centers x 11k cells, about 1 ms. A spatial index is pointless at this size.
    let best = -1;
    let bestKm = RADIUS_KM;
    metros.forEach((m, i) => {
      for (const p of [m, ...(m.also ?? [])]) {
        const d = km(c.lat, c.lon, p.lat, p.lon);
        if (d <= bestKm) [best, bestKm] = [i, d];
      }
    });
    if (best >= 0) buckets[best].push(c);
  }
  const national = cells.reduce((s, c) => s + c.affinity_rank, 0) / (cells.length || 1);
  return metros
    .map((m, i) => {
      const b = buckets[i];
      const score = b.reduce((s, c) => s + c.affinity_rank, 0) / (b.length || 1);
      return {
        name: m.name,
        state: m.state,
        lat: m.lat,
        lon: m.lon,
        score: Math.round(score * 1000) / 1000,
        overIndex: Math.round((score / national) * 100),
        cells: b.length,
        popular: b.filter((c) => c.popularity > 0.5).length,
      };
    })
    .filter((m) => m.popular >= MIN_POPULAR_CELLS)
    // ties on the shown over-index go to the market with more qualifying cells (larger markets win ties);
    // proxy heatmaps from broad national brands often put five markets within a point of each other
    .sort((a, b) => b.overIndex - a.overIndex || b.popular - a.popular || b.score - a.score)
    .map(({ popular: _, ...m }) => m); // eslint-disable-line @typescript-eslint/no-unused-vars
}

// states (refine, e.g. "Texas only"): keep only markets in those states. Over-index stays measured against the whole
// US, so a Texas market at 130 still means 30% above the national average.
export const inStates = (cities: City[], states?: string[] | null) => (states?.length ? cities.filter((c) => c.state && states.includes(c.state)) : cities);

export function buildCities(cells: HeatCell[], states?: string[] | null): Cities {
  return {
    metros: inStates(rankMetros(cells), states),
    cells: [...cells]
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, MAP_CELLS)
      .map((c): MapCell => [c.lat, c.lon, c.affinity, c.popularity]),
    cellCount: cells.length,
    marketCount: metros.length,
  };
}

// Cache-only: the top market for share-link previews, or null when the heatmap isn't cached. Never calls Qloo.
export const peekTopMarket = async (seed: string) => {
  const cells = await heatmap.peek(seed, "United States");
  return cells ? (buildCities(cells).metros[0] ?? null) : null;
};
export const getCities = async (seed: string | Signal[], states?: string[] | null) => buildCities(await heatmap(seed, "United States"), states);
