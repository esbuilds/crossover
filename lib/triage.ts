// Inbound triage. The buckets are decided here, in code; the model only explains them.
// Client-safe: no server imports, so the triage page shares these rules and the share-link parser.

export type Bucket = "take" | "maybe" | "pass";
export const BUCKET_LABEL: Record<Bucket, string> = { take: "Take the call", maybe: "Maybe", pass: "Pass" };
export const MAX_NAMES = 15;

// nameAmongSeed: where the inbound name lands among the seed's fans; seedAmongName: the seed among the name's fans.
// Ranks are 1 to 50, or null outside the fans' top 50.
export function bucketFor(nameAmongSeed: number | null, seedAmongName: number | null): Bucket {
  const a = nameAmongSeed !== null;
  const b = seedAmongName !== null;
  if (a && b && (nameAmongSeed! <= 10 || seedAmongName! <= 10)) return "take";
  if (a !== b) return "maybe";
  return "pass";
}

// A pass can still be a stunt: a very well-known partner whose audience meets the seed's in at least one market.
export const contrastPlay = (bucket: Bucket, partnerPopularity: number, overlapMarkets: number) => bucket === "pass" && partnerPopularity > 0.9 && overlapMarkets >= 1;

// Bucket first (take, maybe, pass), then by the seed's rank among the name's fans (better first, unranked last).
const ORDER: Record<Bucket, number> = { take: 0, maybe: 1, pass: 2 };
export function sortRows<T extends { bucket: Bucket; seedAmongName: number | null }>(rows: T[]): T[] {
  return [...rows].sort((x, y) => ORDER[x.bucket] - ORDER[y.bucket] || (x.seedAmongName ?? 99) - (y.seedAmongName ?? 99));
}

// Share link: /triage/<seed id>?t=<type>&n=<id>:<type>,<id>:<type>... (types without the urn:entity: prefix in n).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT = ["brand", "artist", "tv_show", "movie", "person"];
export type TriageName = { id: string; type: string };
export function parseNames(n: string | null | undefined): TriageName[] | null {
  if (!n) return null;
  const parts = n.split(",").filter(Boolean);
  if (!parts.length || parts.length > MAX_NAMES) return null;
  const out: TriageName[] = [];
  for (const p of parts) {
    const [id, t] = p.split(":");
    if (!UUID.test(id ?? "") || !SHORT.includes(t ?? "")) return null;
    if (!out.some((x) => x.id.toLowerCase() === id.toLowerCase())) out.push({ id, type: `urn:entity:${t}` });
  }
  return out;
}
export const formatNames = (names: TriageName[]) => names.map((x) => `${x.id}:${x.type.replace("urn:entity:", "")}`).join(",");
