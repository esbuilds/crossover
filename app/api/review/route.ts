import { type NextRequest } from "next/server";
import { insights, search, RESOLVE_TYPES, QuotaError, type Entity } from "@/lib/qloo.ts";
import { resolve } from "@/lib/resolve.ts";
import { fixtureByQuery } from "@/lib/fixtures.ts";
import { failCode } from "@/lib/failure.ts";
import { FAIL_COPY } from "@/lib/fail-copy.ts";
import { assemble, identityOf, scoreForward, scoreReverse, toRef, MAX_NAMES, type Buyer, type Identity, type Ref } from "@/lib/review.ts";

// POST /api/review (unlinked), review-v2. Body:
//   { seed: "Liquid Death" | { id, type },
//     names: ["Yeti", { name: "Poppi", id, type }, { name: "Graza", id, type, proxy: true }, ...] (up to 8),
//     buyer?: { exclude?: [{ name, reason }], excludeTags?: ["beer"] },
//     only?: "brand" (search candidates within one entity type; the demo's brand lists use it so "Hey Dude" can't
//     resolve to a TV show) }
// -> Review (lib/review.ts): seed, groups by entity type (rows with forward and reverse cells, evidence, buyer gate;
// selection; affinity and popularity bands), notMeasured (ambiguous, unresolved, proxies), plus ranks: for each
// measured name, where it sits in the seed's fans' top 50 and where the seed sits in its fans' top 50, read from the
// cache only (absent when that list was never fetched; never a call).
// Cost when cold: one search per typed name, one forward call per entity type, one reverse call per measured name.
type NameIn = string | { name: string; id?: string; type?: string; proxy?: boolean };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function byId(id: string, type: string): Promise<Ref | null> {
  if (!UUID.test(id) || !RESOLVE_TYPES.includes(type)) return null;
  const [hit] = await insights({ "filter.type": type, "filter.results.entities": id, take: 1 });
  return hit ? toRef(hit, type) : null;
}

async function identify(n: NameIn, types = RESOLVE_TYPES): Promise<Identity> {
  const input = typeof n === "string" ? n.trim() : n.name.trim();
  if (typeof n !== "string" && n.id && n.type) {
    const entity = await byId(n.id, n.type);
    if (!entity) return { state: "unresolved", input };
    return n.proxy ? { state: "proxy", input, entity } : { state: "confirmed", input, entity, via: "chosen id" };
  }
  if (typeof n !== "string" && n.proxy) return { state: "unresolved", input }; // a stand-in needs a chosen entity
  const fx = types === RESOLVE_TYPES ? fixtureByQuery(input) : undefined;
  return identityOf(input, fx ? fx.resolution : await resolve(input, (await search(input, types, 5)) as Entity[]));
}

const scorer = (p: Record<string, string | number>) => insights(p);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const names: NameIn[] | null = Array.isArray(body?.names) ? body.names : null;
  const valid = (n: unknown) => (typeof n === "string" ? n.trim().length > 0 && n.length <= 100 : typeof (n as { name?: unknown })?.name === "string");
  if (!body?.seed || !names || !names.length || names.length > MAX_NAMES || !names.every(valid))
    return Response.json({ error: `seed and 1 to ${MAX_NAMES} names are required` }, { status: 400 });
  const buyer: Buyer = { exclude: Array.isArray(body.buyer?.exclude) ? body.buyer.exclude : [], excludeTags: Array.isArray(body.buyer?.excludeTags) ? body.buyer.excludeTags : [] };

  try {
    const seedId = await identify(typeof body.seed === "string" ? body.seed : { name: body.seed.name ?? "seed", id: body.seed.id, type: body.seed.type });
    if (seedId.state !== "confirmed") return Response.json({ error: "confirm the seed first", seed: seedId }, { status: 422 });
    const seed = seedId.entity;

    const only = typeof body.only === "string" ? `urn:entity:${body.only}` : null;
    if (only && !RESOLVE_TYPES.includes(only)) return Response.json({ error: "only must be an entity type such as brand" }, { status: 400 });
    const ids: Identity[] = [];
    for (const n of names) ids.push(await identify(n, only ? [only] : RESOLVE_TYPES)); // serial: never fan out against Qloo
    const kept = ids.filter((i) => !(i.state === "confirmed" && i.entity.entity_id === seed.entity_id));
    const measured = kept.flatMap((i) => (i.state === "confirmed" ? [i.entity] : []));

    const forward = await scoreForward(seed, measured, scorer);
    const reverse = await scoreReverse(seed, measured, scorer);
    const rankIn = async (category: string, fansOf: string, id: string) => {
      const list = await insights.peek({ "filter.type": category, "signal.interests.entities": fansOf, take: 50 });
      return list ? list.findIndex((e) => e.entity_id === id) + 1 || null : undefined;
    };
    const ranks: Record<string, { amongSeedFans?: number | null; seedAmongTheirs?: number | null }> = {};
    for (const m of measured) ranks[m.entity_id] = { amongSeedFans: await rankIn(m.type, seed.entity_id, m.entity_id), seedAmongTheirs: await rankIn(seed.type, m.entity_id, seed.entity_id) };
    return Response.json({ ...assemble(seed, kept, forward, reverse, buyer), ranks }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[review]", err);
    const code = failCode(err);
    if (code) return Response.json({ error: FAIL_COPY[code], code }, { status: 503 });
    if (err instanceof QuotaError) return Response.json({ error: "Qloo's taste data is busy right now; try again in a minute." }, { status: 503 });
    return Response.json({ error: "Qloo request failed" }, { status: 502 });
  }
}
