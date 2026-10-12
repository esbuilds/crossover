// Who leads each city (round 3 pick 2, "the big three"): three camp heads of an aisle, each brand's national heatmap
// ranked by percentile within the cells all three carry (the pair map's rule: a brand can't lead a cell it has no
// reading for, and raw ranks are skewed by footprint). A cell goes to the brand with the highest percentile there,
// blank where none reaches its own top half. "Leads" = over-indexes most relative to its own pattern, not most fans.
import { heatmap, type HeatCell } from "./qloo.ts";
import { marketOf } from "./cities.ts";
import { CATEGORIES } from "./constellation-cases.ts";

export type LeaderCell = [lat: number, lon: number, k: number];
export type Market = { name: string; state: string; leader: number; cells: number; share: number };
export type Leaders = { slug: string; title: string; brands: { name: string; id: string; cells: number }[]; common: number; cells: LeaderCell[]; region: number; markets: Market[]; why?: string };

const key = (c: { lat: number; lon: number }) => `${c.lat},${c.lon}`;
const percentiles = (xs: number[]) => {
  const order = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
  const out = new Array<number>(xs.length);
  order.forEach(([, i], k) => (out[i] = xs.length > 1 ? k / (xs.length - 1) : 1));
  return out;
};

// Pure: the winner rule over the cells every map carries.
export function leadersOf(maps: HeatCell[][]): { cells: LeaderCell[]; common: number } {
  const shared = maps.map((m) => new Set(m.map(key))).reduce((a, b) => new Set([...a].filter((k) => b.has(k))));
  const best = new Map<string, { lat: number; lon: number; k: number; p: number }>();
  maps.forEach((m, k) => {
    const inCommon = m.filter((c) => shared.has(key(c)));
    const p = percentiles(inCommon.map((c) => c.affinity_rank));
    inCommon.forEach((c, i) => {
      if (p[i] < 0.5) return;
      const cur = best.get(key(c));
      if (!cur || p[i] > cur.p) best.set(key(c), { lat: c.lat, lon: c.lon, k, p: p[i] });
    });
  });
  return { cells: [...best.values()].map((b): LeaderCell => [b.lat, b.lon, b.k]), common: shared.size };
}

// Pure: the share of coloured cells (with at least one coloured neighbour on the grid) whose leader matches the
// majority of their neighbours. The grid step is the median spacing between distinct latitudes and longitudes.
export function regionShare(cells: LeaderCell[]): number {
  const step = (xs: number[]) => {
    const u = [...new Set(xs)].sort((a, b) => a - b);
    const d = u.slice(1).map((x, i) => +(x - u[i]).toFixed(4)).filter((x) => x > 0).sort((a, b) => a - b);
    return d[Math.floor(d.length / 2)] ?? 1;
  };
  const dLat = step(cells.map((c) => c[0])) * 1.5, dLon = step(cells.map((c) => c[1])) * 1.5;
  let agree = 0, counted = 0;
  for (const c of cells) {
    const tally = new Map<number, number>();
    for (const o of cells) if (o !== c && Math.abs(o[0] - c[0]) <= dLat && Math.abs(o[1] - c[1]) <= dLon) tally.set(o[2], (tally.get(o[2]) ?? 0) + 1);
    if (!tally.size) continue;
    counted++;
    if ([...tally.entries()].sort((x, y) => y[1] - x[1])[0][0] === c[2]) agree++;
  }
  return counted ? agree / counted : 0;
}

// Pure: the twelve markets with the most coloured cells, each with its leader and that leader's share there.
export function marketsOf(cells: LeaderCell[], n = 12): Market[] {
  const by = new Map<string, { name: string; state: string; counts: number[] }>();
  for (const [lat, lon, k] of cells) {
    const m = marketOf(lat, lon);
    if (!m) continue;
    const e = by.get(m.name) ?? { ...m, counts: [0, 0, 0] };
    e.counts[k]++;
    by.set(m.name, e);
  }
  return [...by.values()]
    .map((e) => {
      const total = e.counts.reduce((a, b) => a + b, 0);
      const leader = e.counts.indexOf(Math.max(...e.counts));
      return { name: e.name, state: e.state, leader, cells: total, share: e.counts[leader] / total };
    })
    .sort((a, b) => b.cells - a.cells)
    .slice(0, n);
}

// null: no leaders map for this aisle. "cold": a heatmap isn't cached and peek asked (crawlers, the share card).
export async function getLeaders(slug: string, peek = false): Promise<Leaders | null | "cold"> {
  const cat = CATEGORIES.find((c) => c.slug === slug);
  if (!cat?.leaders) return null;
  const brands = cat.leaders.names.map((n) => cat.brands.find((b) => b.name === n)!);
  const maps: HeatCell[][] = [];
  for (const b of brands) {
    const m = peek ? await heatmap.peek(b.id, "United States") : await heatmap(b.id, "United States");
    if (m === null) return "cold";
    maps.push(m);
  }
  const { cells, common } = leadersOf(maps);
  const counts = [0, 0, 0];
  for (const c of cells) counts[c[2]]++;
  return {
    slug,
    title: cat.title,
    brands: brands.map((b, k) => ({ name: b.name, id: b.id, cells: counts[k] })),
    common,
    cells,
    region: regionShare(cells),
    markets: marketsOf(cells),
    why: cat.leaders.why,
  };
}
