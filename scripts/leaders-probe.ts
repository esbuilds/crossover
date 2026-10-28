// Aisle leaders probe, energy aisle only. Each brand's national heatmap is
// re-ranked by percentile within itself; a cell goes to the brand with the highest percentile there, blank where no
// brand reaches its own top half. Gate: no brand above 40% of coloured cells, and at least 55% of coloured cells
// share their winner with the majority of their coloured neighbours (regions, not noise). About 6 calls, serial.
//   node --env-file=.env.local scripts/leaders-probe.ts [slug]
import { heatmap } from "../lib/qloo.ts";
import { CATEGORIES } from "../lib/constellation-cases.ts";

const slug = process.argv[2] ?? "energy-drinks";
// --common: rank each brand within the cells every brand carries (the pair map's rule); default ranks within each brand's own cells
const COMMON = process.argv.includes("--common");
const cat0 = CATEGORIES.find((c) => c.slug === slug)!;
// --brands=A,B,C: only these brands of the aisle (option D: the brands that head the camps)
const only = process.argv.find((a) => a.startsWith("--brands="))?.slice(9).split(",");
const cat = only ? { ...cat0, brands: cat0.brands.filter((b) => only.includes(b.name)) } : cat0;
const pct = (xs: number[]) => {
  const order = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
  const out = new Array<number>(xs.length);
  order.forEach(([, i], k) => (out[i] = xs.length > 1 ? k / (xs.length - 1) : 1));
  return out;
};
const best = new Map<string, { brand: string; p: number; lat: number; lon: number }>();
const cellsPer: Record<string, number> = {};
const maps = new Map<string, Awaited<ReturnType<typeof heatmap>>>();
for (const b of cat.brands) maps.set(b.name, await heatmap(b.id, "United States"));
const key = (c: { lat: number; lon: number }) => `${c.lat},${c.lon}`;
const common = COMMON ? new Set([...maps.values()].map((m) => new Set(m.map(key))).reduce((a, b) => new Set([...a].filter((k) => b.has(k))))) : null;
if (common) console.log(`cells every brand carries: ${common.size}`);
for (const b of cat.brands) {
  const cells = maps.get(b.name)!.filter((c) => !common || common.has(key(c)));
  cellsPer[b.name] = cells.length;
  const p = pct(cells.map((c) => c.affinity_rank));
  cells.forEach((c, i) => {
    if (p[i] < 0.5) return;
    const k = `${c.lat},${c.lon}`;
    const cur = best.get(k);
    if (!cur || p[i] > cur.p) best.set(k, { brand: b.name, p: p[i], lat: c.lat, lon: c.lon });
  });
}
const coloured = [...best.values()];
const share: Record<string, number> = {};
for (const c of coloured) share[c.brand] = (share[c.brand] ?? 0) + 1;
// neighbours on the grid: the nearest distinct latitude and longitude steps around each cell
const lats = [...new Set(coloured.map((c) => c.lat))].sort((a, b) => a - b);
const step = (xs: number[]) => {
  const d = xs.slice(1).map((x, i) => +(x - xs[i]).toFixed(4)).filter((x) => x > 0);
  d.sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)];
};
const dLat = step(lats);
const lonStep = step([...new Set(coloured.map((c) => c.lon))].sort((a, b) => a - b));
const near = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => a !== b && Math.abs(a.lat - b.lat) <= dLat * 1.5 && Math.abs(a.lon - b.lon) <= lonStep * 1.5;
let agree = 0, withNeighbours = 0;
for (const c of coloured) {
  const ns = coloured.filter((o) => near(c, o));
  if (!ns.length) continue;
  withNeighbours++;
  const count: Record<string, number> = {};
  for (const n of ns) count[n.brand] = (count[n.brand] ?? 0) + 1;
  const top = Object.entries(count).sort((x, y) => y[1] - x[1])[0][0];
  if (top === c.brand) agree++;
}
const total = coloured.length;
const maxShare = Math.max(...Object.values(share)) / total;
const region = agree / (withNeighbours || 1);
console.log(`## ${cat.title}: national cells per brand`, JSON.stringify(cellsPer));
console.log(`coloured cells ${total}; grid step lat ${dLat}, lon ${lonStep}`);
console.log("share:", Object.entries(share).sort((x, y) => y[1] - x[1]).map(([b, n]) => `${b} ${n} (${((100 * n) / total).toFixed(1)}%)`).join(", "));
console.log(`largest share ${(100 * maxShare).toFixed(1)}% (gate <= 40%); cells agreeing with neighbour majority ${(100 * region).toFixed(1)}% of ${withNeighbours} with neighbours (gate >= 55%)`);
console.log(`VERDICT ${maxShare <= 0.4 && region >= 0.55 ? "PASS" : "FAIL"}`);
