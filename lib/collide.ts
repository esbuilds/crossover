// Collision map (Oct 14 row, brief-oct13-vs map defaults): two heatmaps on Qloo's shared geohash grid, diffed per cell.
// Each side's affinity_rank is re-ranked within the cells both heatmaps carry, because raw ranks are skewed by how many
// cells each side has (Olipop's sit 0.24 above Poppi's at the median). Cells missing on either side are not drawn.
// The page shows a lean per cell, never a number.
import type { HeatCell } from "./qloo.ts";

export const LEAN_SPLIT = 0.25; // percentile gap for a cell to lean one way (a quarter of the ranking)
const HOT = 0.5; // drawn only where at least one side is in its top half
const MAX_CELLS = 1500; // as the single map: the hottest cells only

export type Tone = "a" | "b" | "both";
// SVG and inline styles take no CSS vars: A is --color-accent (as app/map.tsx ACCENT and the bars), B a dark ink
// (darker than ink-2 since real Oct 20, CT F4: the two sides sat at one luminance, 1.21:1; now 1.65:1, and B's cells
// 4.9:1 on land), both --color-rule-strong. Here, not in the client map, so the server page's legend gets the values too.
export const TONE: Record<Tone, string> = { a: "#bd4510", b: "#3b3634", both: "#c8c4c1" };
export type CollideCell = [lat: number, lon: number, tone: Tone];
export type Collision = { cells: CollideCell[]; matched: number; counts: Record<Tone, number> };

const percentiles = (xs: number[]) => {
  const order = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
  const out = new Array<number>(xs.length);
  order.forEach(([, i], k) => (out[i] = xs.length > 1 ? k / (xs.length - 1) : 1));
  return out;
};

export function collide(A: HeatCell[], B: HeatCell[]): Collision {
  const key = (c: HeatCell) => `${c.lat},${c.lon}`;
  const inB = new Map(B.map((c) => [key(c), c]));
  const pairs = A.flatMap((a) => (inB.has(key(a)) ? [[a, inB.get(key(a))!] as const] : []));
  const pa = percentiles(pairs.map(([a]) => a.affinity_rank));
  const pb = percentiles(pairs.map(([, b]) => b.affinity_rank));
  const counts: Record<Tone, number> = { a: 0, b: 0, both: 0 };
  const cells = pairs
    .map(([c], i) => ({ c, heat: Math.max(pa[i], pb[i]), d: pa[i] - pb[i] }))
    .filter((x) => x.heat >= HOT)
    .sort((x, y) => y.heat - x.heat)
    .slice(0, MAX_CELLS)
    .map(({ c, d }): CollideCell => {
      const tone: Tone = d >= LEAN_SPLIT ? "a" : -d >= LEAN_SPLIT ? "b" : "both";
      counts[tone]++;
      return [c.lat, c.lon, tone];
    });
  return { cells, matched: pairs.length, counts };
}
