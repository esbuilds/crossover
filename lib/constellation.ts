// Category constellation (brief-oct13-moonshots pick 1): one category's brands laid out by mutual audience affinity.
// Every brand but the last scores all the others in one call (filter.results.entities), so each pair has at least one
// reading and usually two; same-type affinity is symmetric (VERIFY-3), so the two are averaged. Distance is 1 minus
// affinity, projected to 2-D by classical MDS in code. No model. 0 calls warm, n-1 calls cold per category.
import { insights, type Entity } from "./qloo.ts";
import { applyMissingRule } from "./review.ts";

const BRAND = "urn:entity:brand";
export type Brand = { name: string; id: string };
export type Category = { slug: string; title: string; brands: Brand[] };

// Ids from /search on real Oct 12 (probe/constellation-ids.json). Qloo has no brand entity for Alani Nu, Ghost, Prime,
// Culture Pop or San Pellegrino, and "Topo Chico" finds only the hard seltzer, so they're left out (the page says so).
export const CATEGORIES: Category[] = [
  {
    slug: "energy-drinks",
    title: "Energy drinks",
    brands: [
      { name: "Red Bull", id: "409FAF5A-BC5F-4DC3-943D-E3B5F20B471D" },
      { name: "Monster Energy", id: "8376EDE4-3EA9-440B-B424-6BBFB13EB6F0" },
      { name: "Celsius", id: "D64DC967-F529-4A3F-9F89-774CE5118EF4" },
      { name: "Rockstar", id: "785995B1-45EE-4A93-AE26-7E190EDA7683" },
      { name: "Bang", id: "6D658357-3155-4983-947A-3E450570F879" },
      { name: "C4 Energy", id: "849A4730-E426-46DF-A3FC-D301F71236EE" },
      { name: "Reign", id: "AE366930-7BD7-4E8D-80D0-F3C290434144" },
      { name: "5-hour Energy", id: "52B57FB5-2C81-4CCF-9234-B4D68CBA86F5" },
      { name: "ZOA Energy", id: "487DBD74-7D2F-44B9-9D55-75BAA94C0F18" },
    ],
  },
  {
    slug: "soda-and-sparkling-water",
    title: "Better-for-you soda and sparkling water",
    brands: [
      { name: "Olipop", id: "6647FB92-9390-4B58-885B-86D96FF5BB6D" },
      { name: "Poppi", id: "8D1C70F5-AECA-4309-8BBF-B2B5A5AEFE59" },
      { name: "Zevia", id: "4A64547B-9F90-4CEE-B04C-CFB018E00E0D" },
      { name: "Health-Ade", id: "E95AEC3D-1FB3-49E4-AEF2-EF75A86F29CB" },
      { name: "Simply Pop", id: "B5BC1D3B-26E7-4BD8-B7D7-60454AEE3291" },
      { name: "LaCroix", id: "7D33F70F-60D7-485F-8B1C-454B7B50E849" },
      { name: "Bubly", id: "45617653-55F8-44CD-949D-2D16ECD8C2DD" },
      { name: "Spindrift", id: "AB20E24F-7B08-4215-BA29-ED341192FE3F" },
      { name: "Perrier", id: "6DED2E11-2AA3-498A-9D67-E59326147EA2" },
    ],
  },
  {
    slug: "outdoor-apparel",
    title: "Outdoor apparel",
    brands: [
      { name: "Patagonia", id: "DB4CE34E-3A63-4947-946F-9D52502C5762" },
      { name: "The North Face", id: "DB03F250-64F3-47AB-8756-BC1C4E13EBFD" },
      { name: "Arc'teryx", id: "B2A2238B-5FDC-46CD-B6F9-A32DB1474C70" },
      { name: "Columbia", id: "DD982800-A3A4-40A6-A30D-276B7FEA74A3" },
      { name: "REI", id: "205AF33F-118E-4C49-9721-6BDBAF981DA0" },
      { name: "Cotopaxi", id: "4F0F8472-9240-4573-93BE-C6DB118FD65A" },
      { name: "Outdoor Voices", id: "011DFDA5-F5A7-461A-9D96-E28E4964E7FB" },
      { name: "Marmot", id: "9EF335BD-7564-41DA-862F-099A5742BC02" },
      { name: "Fjällräven", id: "1BFF764A-D06D-48CA-9075-1E0F2A3FCE3D" },
      { name: "Carhartt", id: "2D69DB33-B4DF-4879-B3DC-308E3402A1FD" },
      { name: "L.L.Bean", id: "0E3A4DBB-917E-47D7-8147-6A36213A40D7" },
      { name: "Vuori", id: "D619A0B2-F0ED-4DD3-97D9-00BDC4F32E7C" },
    ],
  },
];

export type Dot = { name: string; id: string; popularity: number | null; x: number; y: number };
export type Near = { name: string; id: string; affinity: number };
export type Constellation = {
  slug: string;
  title: string;
  dots: Dot[];
  nearest: { name: string; near: Near[] }[];
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
      if (v !== null) (reads[i][j].push(v), reads[j][i].push(v));
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
