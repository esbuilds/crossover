// Category constellation (brief-oct13-moonshots pick 1): one category's brands laid out by mutual audience affinity.
// Every brand but the last scores all the others in one call (filter.results.entities), so each pair has at least one
// reading and usually two; same-type affinity is symmetric (VERIFY-3), so the two are averaged. Distance is 1 minus
// affinity, projected to 2-D by classical MDS in code. No model. 0 calls warm, n-1 calls cold per category.
import { insights, type Entity } from "./qloo.ts";
import { applyMissingRule } from "./review.ts";
import { CATEGORIES, type Category } from "./constellation-cases.ts";
export { CATEGORIES, type Category };

const BRAND = "urn:entity:brand";

export type Dot = { name: string; id: string; popularity: number | null; x: number; y: number };
export type Near = { name: string; id: string; affinity: number };
export type Constellation = {
  slug: string;
  title: string;
  dots: Dot[];
  nearest: { name: string; near: Near[] }[];
  affinity: (number | null)[][]; // aligned with dots
  absent: string[];
  notMeasured: string[];
  filled: number; // pairs with no reading, placed at the mean distance (said in the log)
  stress: number; // Kruskal stress-1 of the projection
  calls: number;
};

// Classical MDS: double-centre the squared distances, take the top two eigenvectors by power iteration.
// ponytail: power iteration with deflation; fine for n <= 12, use a real eigensolver if categories grow past ~50.
export function mds(D: number[][]): [number, number][] {
  const n = D.length;
  const sq = D.map((r) => r.map((d) => d * d));
  const rowMean = sq.map((r) => r.reduce((a, b) => a + b, 0) / n);
  const all = rowMean.reduce((a, b) => a + b, 0) / n;
  const B = sq.map((r, i) => r.map((d, j) => -0.5 * (d - rowMean[i] - rowMean[j] + all)));
  const coords: number[][] = Array.from({ length: n }, () => []);
  for (let k = 0; k < 2; k++) {
    let v = Array.from({ length: n }, (_, i) => Math.sin(i + 1 + k)); // fixed start: deterministic layout
    let lambda = 0;
    for (let it = 0; it < 500; it++) {
      const w = B.map((r) => r.reduce((a, b, j) => a + b * v[j], 0));
      const norm = Math.hypot(...w) || 1;
      lambda = norm;
      v = w.map((x) => x / norm);
    }
    const s = Math.sqrt(Math.max(lambda, 0));
    v.forEach((x, i) => coords[i].push(x * s));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B[i][j] -= lambda * v[i] * v[j];
  }
  return coords.map((c) => [c[0], c[1]]);
}

export function stress(D: number[][], xy: [number, number][]): number {
  let num = 0, den = 0;
  for (let i = 0; i < D.length; i++)
    for (let j = i + 1; j < D.length; j++) {
      const d = Math.hypot(xy[i][0] - xy[j][0], xy[i][1] - xy[j][1]);
      num += (D[i][j] - d) ** 2;
      den += D[i][j] ** 2;
    }
  return den ? Math.sqrt(num / den) : 0;
}

// Pure: rows[i] is seed i's call (null for the last brand, never a seed). Missing rule within each call, as the review desk.
export function build(cat: Category, rows: (Entity[] | null)[], calls = 0): Constellation {
  const n = cat.brands.length;
  const idx = new Map(cat.brands.map((b, i) => [b.id.toUpperCase(), i]));
  const reads: number[][][] = Array.from({ length: n }, () => Array.from({ length: n }, () => []));
  const pop: (number | null)[] = Array(n).fill(null);
  rows.forEach((hits, i) => {
    if (!hits) return;
    const cells = applyMissingRule(hits.map((h) => h.affinity), "one call");
    hits.forEach((h, k) => {
      const j = idx.get(h.entity_id.toUpperCase());
      if (j === undefined || j === i) return;
      pop[j] = h.popularity;
      const v = cells[k].value;
      if (v !== null) {
        reads[i][j].push(v);
        reads[j][i].push(v);
      }
    });
  });
  const aff = reads.map((r) => r.map((xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)));
  // a brand with readings for fewer than half the others is listed, never placed
  const keep = cat.brands.map((_, i) => aff[i].filter((v, j) => j !== i && v !== null).length >= (n - 1) / 2);
  const kept = cat.brands.map((b, i) => ({ b, i })).filter((x) => keep[x.i]);
  const known = kept.flatMap((x) => kept.filter((y) => y.i > x.i).map((y) => aff[x.i][y.i])).filter((v): v is number => v !== null);
  const meanD = known.length ? 1 - known.reduce((a, b) => a + b, 0) / known.length : 0.5;
  let filled = 0;
  const D = kept.map((x) =>
    kept.map((y) => {
      if (x.i === y.i) return 0;
      const v = aff[x.i][y.i];
      if (v === null) return (filled++, meanD);
      return 1 - v;
    }),
  );
  const xy = kept.length >= 3 ? mds(D) : kept.map((): [number, number] => [0, 0]);
  return {
    slug: cat.slug,
    title: cat.title,
    dots: kept.map((x, k) => ({ name: x.b.name, id: x.b.id, popularity: pop[x.i], x: xy[k][0], y: xy[k][1] })),
    nearest: kept.map((x) => ({
      name: x.b.name,
      near: kept
        .filter((y) => y.i !== x.i && aff[x.i][y.i] !== null)
        .map((y) => ({ name: y.b.name, id: y.b.id, affinity: aff[x.i][y.i]! }))
        .sort((p, q) => q.affinity - p.affinity)
        .slice(0, 3),
    })),
    affinity: kept.map((x) => kept.map((y) => (x.i === y.i ? null : aff[x.i][y.i]))),
    absent: cat.absent ?? [],
    notMeasured: cat.brands.filter((_, i) => !keep[i]).map((b) => b.name),
    filled: filled / 2,
    stress: stress(D, xy),
    calls,
  };
}

export async function getConstellation(slug: string, peek = false): Promise<Constellation | null | "cold"> {
  const cat = CATEGORIES.find((c) => c.slug === slug);
  if (!cat) return null;
  const get = (p: Record<string, string | number>) => (peek ? insights.peek(p) : insights(p));
  const rows: (Entity[] | null)[] = [];
  for (let i = 0; i < cat.brands.length - 1; i++) {
    const others = cat.brands.filter((_, j) => j !== i).map((b) => b.id);
    const hits = await get({ "filter.type": BRAND, "signal.interests.entities": cat.brands[i].id, "filter.results.entities": others.join(","), take: others.length });
    if (hits === null) return "cold";
    rows.push(hits);
  }
  rows.push(null);
  return build(cat, rows, cat.brands.length - 1);
}

// --- your brand on the aisle (brief-oct13-moonshots-3 pick 1) ---
// A typed brand is scored once against the aisle (same-type affinity is symmetric, so one call gives both directions)
// and dropped onto the fixed layout: the point whose distances to its three nearest brands best match 1 - affinity,
// by least squares. The prepared dots never move. fit is the placement's stress-1, comparable to the layout's.
export type Placement = { x: number; y: number; near: Near[]; fit: number };
export function placePoint(dots: Dot[], aff: (number | null)[]): Placement | null {
  const near = dots
    .map((d, i) => ({ d, a: aff[i] }))
    .filter((x): x is { d: Dot; a: number } => x.a !== null)
    .sort((p, q) => q.a - p.a)
    .slice(0, 3);
  if (near.length < 3) return null;
  const target = near.map((n) => 1 - n.a);
  // start at the affinity-weighted centroid, then gradient steps on the squared distance error
  const w = near.map((n) => n.a);
  let x = near.reduce((s, n, k) => s + n.d.x * w[k], 0) / w.reduce((a, b) => a + b, 0);
  let y = near.reduce((s, n, k) => s + n.d.y * w[k], 0) / w.reduce((a, b) => a + b, 0);
  for (let it = 0; it < 2000; it++) {
    let gx = 0, gy = 0;
    near.forEach((n, k) => {
      const dx = x - n.d.x, dy = y - n.d.y, r = Math.hypot(dx, dy) || 1e-9;
      const e = r - target[k];
      gx += (e * dx) / r;
      gy += (e * dy) / r;
    });
    x -= 0.1 * gx;
    y -= 0.1 * gy;
  }
  let num = 0, den = 0;
  near.forEach((n, k) => {
    num += (Math.hypot(x - n.d.x, y - n.d.y) - target[k]) ** 2;
    den += target[k] ** 2;
  });
  return { x, y, near: near.map((n) => ({ name: n.d.name, id: n.d.id, affinity: n.a })), fit: den ? Math.sqrt(num / den) : 0 };
}

export type Placed = { id: string; inAisle: boolean; placement: Placement | null; calls: number };
// null: unknown aisle. "cold": not cached and peek asked. A brand already on the aisle is just highlighted.
export async function placeOnAisle(slug: string, id0: string, peek: boolean): Promise<Placed | null | "cold"> {
  const id = id0.toUpperCase();
  const c = await getConstellation(slug, true);
  if (!c || c === "cold") return c;
  if (c.dots.some((d) => d.id.toUpperCase() === id)) return { id, inAisle: true, placement: null, calls: 0 };
  const p = { "filter.type": BRAND, "signal.interests.entities": id, "filter.results.entities": c.dots.map((d) => d.id).join(","), take: c.dots.length };
  const hits = peek ? await insights.peek(p) : await insights(p);
  if (hits === null) return "cold";
  const cells = applyMissingRule(hits.map((h) => h.affinity), "one call");
  const byId = new Map(hits.map((h, k) => [h.entity_id.toUpperCase(), cells[k].value]));
  const aff = c.dots.map((d) => byId.get(d.id.toUpperCase()) ?? null);
  return { id, inAisle: false, placement: placePoint(c.dots, aff), calls: peek ? 0 : 1 };
}
