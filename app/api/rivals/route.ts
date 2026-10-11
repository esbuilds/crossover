import { type NextRequest } from "next/server";
import { insights, RESOLVE_TYPES, QuotaError } from "@/lib/qloo.ts";
import { failCode } from "@/lib/failure.ts";
import { FAIL_COPY } from "@/lib/fail-copy.ts";
import { getRivals } from "@/lib/rivals.ts";

// GET /api/rivals?a=<id>&ta=<type>&b=<id>&tb=<type> (unlinked), rivals-v1 -> Rivals (lib/rivals.ts).
// Ids only: names go through the picker on the front door (Oct 15 row). Cold: 2 card lookups, 2 lists, 2 to 4 scores.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const sides = [["a", "ta"], ["b", "tb"]].map(([i, t]) => ({ id: q.get(i) ?? "", type: q.get(t) ?? "" }));
  if (!sides.every((s) => UUID.test(s.id) && RESOLVE_TYPES.includes(s.type)) || sides[0].id === sides[1].id)
    return Response.json({ error: "two different entity ids with their types are required" }, { status: 400 });
  try {
    const cards = [];
    for (const s of sides) cards.push((await insights({ "filter.type": s.type, "filter.results.entities": s.id, take: 1 }))[0]); // serial
    if (!cards[0] || !cards[1]) return Response.json({ error: "Qloo doesn't know one of these ids" }, { status: 404 });
    return Response.json(await getRivals(cards[0], cards[1]), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[rivals]", err);
    const code = failCode(err);
    if (code) return Response.json({ error: FAIL_COPY[code], code }, { status: 503 });
    if (err instanceof QuotaError) return Response.json({ error: "Qloo's taste data is busy right now; try again in a minute." }, { status: 503 });
    return Response.json({ error: "Qloo request failed" }, { status: 502 });
  }
}
