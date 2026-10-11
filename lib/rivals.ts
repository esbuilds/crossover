// Rivals (rivals-v1, wow brief Oct 11; probe/VERIFY-4.md). Two seeds, both seeds' top 50 brands, the union scored under
// each seed in the same call shape, split by the review GAP: leans A, leans B, shared. Brands only.
// Copy rules live in the brief: "sits closer to A", never "prefers"; no audience labels; no counts.
import { insights, type Entity } from "./qloo.ts";
import { fansTop50 } from "./fit.ts";
import { applyMissingRule, GAP } from "./review.ts";

export const RIVALS_VERSION = "rivals-v1";
const BRAND = "urn:entity:brand";
const BATCH = 50; // Qloo's take ceiling: a 100-name union is two calls per seed (VERIFY-4)
const EPS = 1e-9; // 0.85 - 0.8 is 0.04999... in floating point; "0.05 or more" means 0.05 counts
const MIN_SHARED = 3; // under this the page is two lists and says the audiences barely overlap

export type Seed = { entity_id: string; name: string; type: string };
export type Lean = "a" | "b" | "shared" | "no data";
export type RivalRow = { id: string; name: string; a: number | null; b: number | null; lean: Lean; rankA: number | null; rankB: number | null };
export type Rivals = {
  version: string;
  a: Seed;
  b: Seed;
  leansA: RivalRow[];
  leansB: RivalRow[];
  shared: RivalRow[];
  // the seeds' own field (other baseball clubs for the Dodgers): kept, but out of the columns (VERIFY-4 finding 4)
  sameField: RivalRow[];
  noData: RivalRow[];
  layout: "three" | "two";
};
type Scored = { entity_id: string; affinity?: number };

// a brand's fields: its second-level genre tags (urn:tag:genre:brand:sports_organization:baseball,
// ...:food_and_beverage:drinks). The top level was too broad: food_and_beverage took 57 of Olipop vs Poppi's 89.
// ponytail: tags are trimmed to 12 per entity, so a brand whose genre tag sits past the cut (Juventus) slips through
// to the columns; read untrimmed tags if that shows up on a prepared pair.
const fields = (e: Entity) =>
  new Set(e.tags.map((t) => t.tag_id).filter((t) => t.startsWith("urn:tag:genre:brand:")).filter((t) => t.split(":").length >= 6).map((t) => t.split(":").slice(0, 6).join(":")));

export function compareLists(a: Entity, b: Entity, listA: Entity[], listB: Entity[], scoresA: Scored[], scoresB: Scored[]): Rivals {
  const rankIn = (list: Entity[]) => new Map(list.map((e, i) => [e.entity_id, i + 1]));
  const [rankA, rankB] = [rankIn(listA), rankIn(listB)];
  const byId = new Map([...listA, ...listB].map((e) => [e.entity_id, e]));
  const union = [...byId.keys()].filter((id) => id !== a.entity_id && id !== b.entity_id);
  const valueIn = (s: Scored[]) => new Map(s.map((x) => [x.entity_id, x.affinity]));
  const [va, vb] = [valueIn(scoresA), valueIn(scoresB)];
  // missing rule (review-v1) within each scoring call, then across the two seeds for each candidate
  const [ca, cb] = [applyMissingRule(union.map((id) => va.get(id)), "one call"), applyMissingRule(union.map((id) => vb.get(id)), "one call")];
  const seedFields = new Set([...fields(a), ...fields(b)]);

  const seed = (e: Entity): Seed => ({ entity_id: e.entity_id, name: e.name, type: e.types.find((t) => t !== "urn:entity") ?? "" });
  const out: Rivals = { version: RIVALS_VERSION, a: seed(a), b: seed(b), leansA: [], leansB: [], shared: [], sameField: [], noData: [], layout: "three" };
  union.forEach((id, i) => {
    const [xa, xb] = applyMissingRule([va.get(id), vb.get(id)], "across signals");
    const A = ca[i].value !== null ? xa.value : null;
    const B = cb[i].value !== null ? xb.value : null;
    const lean: Lean = A === null || B === null ? "no data" : A - B >= GAP - EPS ? "a" : B - A >= GAP - EPS ? "b" : "shared";
    const e = byId.get(id)!;
    const row: RivalRow = { id, name: e.name, a: A, b: B, lean, rankA: rankA.get(id) ?? null, rankB: rankB.get(id) ?? null };
    if (lean === "no data") out.noData.push(row);
    else if ([...fields(e)].some((f) => seedFields.has(f))) out.sameField.push(row);
    else ({ a: out.leansA, b: out.leansB, shared: out.shared })[lean].push(row);
  });
  const gap = (r: RivalRow) => Math.abs(r.a! - r.b!);
  out.leansA.sort((x, y) => gap(y) - gap(x));
  out.leansB.sort((x, y) => gap(y) - gap(x));
  out.shared.sort((x, y) => y.a! + y.b! - (x.a! + x.b!));
  out.sameField.sort((x, y) => gap(y) - gap(x));
  out.layout = out.shared.length < MIN_SHARED ? "two" : "three";
  return out;
}

// Cold: 2 lists + 2 to 4 scoring calls (8 with heatmaps, added on map day). Serial, never fanned out against Qloo.
export async function getRivals(a: Entity, b: Entity): Promise<Rivals> {
  const listA = await fansTop50(BRAND, a.entity_id);
  const listB = await fansTop50(BRAND, b.entity_id);
  const union = [...new Map([...listA, ...listB].map((e) => [e.entity_id, e])).keys()].filter((id) => id !== a.entity_id && id !== b.entity_id);
  const score = async (seed: string) => {
    const out: Scored[] = [];
    for (let i = 0; i < union.length; i += BATCH) {
      const chunk = union.slice(i, i + BATCH);
      out.push(...(await insights({ "filter.type": BRAND, "signal.interests.entities": seed, "filter.results.entities": chunk.join(","), take: chunk.length })));
    }
    return out;
  };
  return compareLists(a, b, listA, listB, await score(a.entity_id), await score(b.entity_id));
}
