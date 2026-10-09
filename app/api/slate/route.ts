import { type NextRequest } from "next/server";
import { getSlate, orderSlate, getCard, toCard } from "@/lib/slate.ts";
import { getCities, buildCities } from "@/lib/cities.ts";
import { fixtureById } from "@/lib/fixtures.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/slate?entity=<qloo entity id>[&type=urn:entity:artist] -> { entity, domains, cities }
// type is a hint from resolve so the card lookup costs 1 call; shared links omit it.
// Qloo responses are cached 30 days in the data cache; the CDN holds the whole response for 30 days too.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("entity") ?? "";
  if (!UUID.test(id)) return Response.json({ error: "entity must be a Qloo entity id" }, { status: 400 });

  const fx = fixtureById(id);
  if (fx && fx.resolution.status === "confident") {
    console.log(`[slate] ${id} from fixture (${fx.query})`);
    const body = { entity: toCard(fx.resolution.match), domains: orderSlate(fx.slate), cities: buildCities(fx.heatmap), source: "fixture" };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  }

  console.log(`[slate] ${id} from Qloo`);
  try {
    const [entity, slate, cities] = await Promise.all([getCard(id, request.nextUrl.searchParams.get("type")), getSlate(id), getCities(id)]);
    if (!entity) return Response.json({ error: "Qloo has no entity with that id" }, { status: 404 });
    return Response.json(
      { entity, domains: orderSlate(slate), cities, source: "qloo" },
      { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    console.error("[slate]", err);
    return Response.json({ error: "Qloo request failed" }, { status: 502 });
  }
}
