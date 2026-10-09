import { type NextRequest } from "next/server";
import { getSlate } from "@/lib/slate.ts";
import { getCities } from "@/lib/cities.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/slate?entity=<qloo entity id> -> { slate, cities }
// Qloo responses are cached 30 days in the data cache; the CDN holds the whole response for 30 days too.
export async function GET(request: NextRequest) {
  const entity = request.nextUrl.searchParams.get("entity") ?? "";
  if (!UUID.test(entity)) return Response.json({ error: "entity must be a Qloo entity id" }, { status: 400 });

  try {
    const started = Date.now();
    const [slate, cities] = await Promise.all([getSlate(entity), getCities(entity)]);
    return Response.json(
      { entity, slate, cities, ms: Date.now() - started },
      { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    console.error("[slate]", err);
    return Response.json({ error: "Qloo request failed" }, { status: 502 });
  }
}
