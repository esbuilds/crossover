// Share links for the Pick three front door (Oct 10). Request parameters only, so a link (and its preview card) never
// needs a Qloo call to describe itself:
//   prepared case:  /?c=mt-joy&p=0,2,5[&g=1]          p = the visitor's picks as indices into the case's names
//   your own list:  /?s=Liquid+Death&n=Yeti&n=Poppi&p=0,1
//   a name the visitor picked from several matches carries its id: n=Dr.+Squatch::<uuid>::urn:entity:brand
// Server-free: the page, the /og route and the client all import it.
import { CASES, type CaseName } from "./review-cases.ts";

export type Shared = { caseKey: string | null; seed: string | CaseName; names: (string | CaseName)[]; picks: number[]; gate: boolean };
type Query = Record<string, string | string[] | undefined>;

export const nameOf = (n: string | CaseName) => (typeof n === "string" ? n : n.name);
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const MAX_NAMES = 8;
const MAX_LEN = 100;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const TYPE = /^urn:entity:[a-z_]+$/;
const encode = (n: string | CaseName) => (typeof n === "string" ? n : `${n.name}::${n.id}::${n.type}`);
// null: a malformed chosen id (the whole link is then rejected, never half-read)
function decode(v: string): string | CaseName | null {
  const [name, id, type] = v.trim().split("::");
  if (!name || name.length > MAX_LEN) return null;
  if (id === undefined) return name;
  return UUID.test(id) && TYPE.test(type ?? "") ? { name, id, type } : null;
}

function picksFrom(raw: string | undefined, count: number): number[] {
  const ids = [...new Set((raw ?? "").split(",").filter(Boolean).map(Number))];
  return ids.length <= 3 && ids.every((i) => Number.isInteger(i) && i >= 0 && i < count) ? ids : [];
}

// null: no share parameters, or ones that don't describe a valid result (the page then opens the default case)
export function parseShare(q: Query): Shared | null {
  const c = CASES.find((x) => x.key === first(q.c));
  if (c) return { caseKey: c.key, seed: c.seed, names: c.names, picks: picksFrom(first(q.p), c.names.length), gate: first(q.g) === "1" };
  const seed = first(q.s) ? decode(first(q.s)!) : null;
  const raw = (Array.isArray(q.n) ? q.n : q.n ? [q.n] : []).filter((n) => n.trim());
  const decoded = raw.map(decode);
  if (!seed || !decoded.length || decoded.some((n) => n === null)) return null;
  const names = decoded.filter((n, i) => decoded.findIndex((m) => nameOf(m!) === nameOf(n!)) === i) as (string | CaseName)[];
  if (names.length > MAX_NAMES) return null;
  return { caseKey: null, seed, names, picks: picksFrom(first(q.p), names.length), gate: false };
}

export function shareQuery(s: Shared): string {
  const q = new URLSearchParams();
  if (s.caseKey) q.set("c", s.caseKey);
  else {
    q.set("s", encode(s.seed));
    for (const n of s.names) q.append("n", encode(n));
  }
  if (s.picks.length) q.set("p", s.picks.join(","));
  if (s.gate) q.set("g", "1");
  return q.toString();
}

// The preview card's words, from the link alone.
export function shareCard(s: Shared | null): { title: string; line: string } {
  if (!s) return { title: "Who should you call first?", line: "Pick three partners, then see how fame and fans' measured taste compare" };
  const seed = nameOf(s.seed);
  const mine = s.picks.map((i) => nameOf(s.names[i]));
  return {
    title: `Who would you call first for ${seed}?`,
    line: mine.length ? `My picks: ${mine.join(", ")}. See what fans' taste says.` : `${s.names.length} brands. Pick three, then see what fans' taste says.`,
  };
}
