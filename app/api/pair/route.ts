import { type NextRequest } from "next/server";
import { getPair } from "@/lib/pairing.ts";
import { QuotaError } from "@/lib/qloo.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/pair?a=<id>&b=<id>[&ta=<type>&tb=<type>] -> the pairing check: both cards, each side's rank among the
// other's fans, overlap markets, shared tags, the verdict class, and the verdict. Type hints save card lookups.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const a = q.get("a") ?? "";
  const b = q.get("b") ?? "";
  if (!UUID.test(a) || !UUID.test(b) || a === b) return Response.json({ error: "a and b must be two different Qloo entity ids" }, { status: 400 });
  try {
    const started = Date.now();
    const pair = await getPair({ id: a, type: q.get("ta") }, { id: b, type: q.get("tb") });
    if (!pair) return Response.json({ error: "Qloo has no entity with one of those ids" }, { status: 404 });
    console.log(`[pair] ${pair.a.name} x ${pair.b.name}: ${pair.kind} in ${Date.now() - started} ms`);
    return Response.json(pair, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[pair]", err);
    if (err instanceof QuotaError) return Response.json({ error: "Qloo's taste data is busy right now. Pairs you've already checked still work; try this one again in a minute." }, { status: 503 });
    return Response.json({ error: "Couldn't check this pairing right now" }, { status: 502 });
  }
}
