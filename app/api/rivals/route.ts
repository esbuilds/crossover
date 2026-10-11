import { type NextRequest } from "next/server";
import { RESOLVE_TYPES, QuotaError } from "@/lib/qloo.ts";
import { failCode } from "@/lib/failure.ts";
import { FAIL_COPY } from "@/lib/fail-copy.ts";
import { generationKey } from "@/lib/agent/stream-cache.ts";
import { ColdPairCap, loadVs } from "@/lib/rivals.ts";

// GET /api/rivals?a=<id>&ta=<type>&b=<id>&tb=<type> (unlinked), rivals-v1 -> VsData (lib/rivals.ts): the /vs page's
// data as JSON. Ids only; names go through the picker on the front door (Oct 15 row). Same per-IP cold-pair limit.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const [a, b] = [["a", "ta"], ["b", "tb"]].map(([i, t]) => ({ id: q.get(i) ?? "", type: q.get(t) ?? "" }));
  if (![a, b].every((s) => UUID.test(s.id) && RESOLVE_TYPES.includes(s.type)) || a.id === b.id)
    return Response.json({ error: "two different entity ids with their types are required" }, { status: 400 });
  try {
    const data = await loadVs(a, b, generationKey(request));
    if (!data) return Response.json({ error: "Qloo doesn't know one of these ids" }, { status: 404 });
    return Response.json(data.rivals, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[rivals]", err);
    if (err instanceof ColdPairCap) return Response.json({ error: "That's ten new pairs today. The prepared pairs still work.", code: "cap" }, { status: 503 });
    const code = failCode(err);
    if (code) return Response.json({ error: FAIL_COPY[code], code }, { status: 503 });
    if (err instanceof QuotaError) return Response.json({ error: "Qloo's taste data is busy right now; try again in a minute." }, { status: 503 });
    return Response.json({ error: "Qloo request failed" }, { status: 502 });
  }
}
