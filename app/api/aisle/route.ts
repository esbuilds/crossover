import { type NextRequest } from "next/server";
import { QuotaError } from "@/lib/qloo.ts";
import { failCode } from "@/lib/failure.ts";
import { FAIL_COPY } from "@/lib/fail-copy.ts";
import { generationKey } from "@/lib/agent/stream-cache.ts";
import { ColdPairCap, spendColdPair } from "@/lib/rivals.ts";
import { placeOnAisle } from "@/lib/constellation.ts";

// GET /api/aisle?slug=<category>&id=<brand id> -> Placed (lib/constellation.ts): a typed brand dropped onto a prepared
// aisle. 0 calls when cached; a cold brand is one scoring call and counts as one of the visitor's ten cold pairs.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const slug = q.get("slug") ?? "", id = q.get("id") ?? "";
  if (!UUID.test(id) || !/^[a-z-]{1,40}$/.test(slug)) return Response.json({ error: "a category and a brand id are required" }, { status: 400 });
  try {
    let r = await placeOnAisle(slug, id, true);
    if (r === "cold") {
      await spendColdPair(generationKey(request));
      r = await placeOnAisle(slug, id, false);
    }
    if (!r || r === "cold") return Response.json({ error: "Unknown category" }, { status: 404 });
    return Response.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[aisle]", err);
    if (err instanceof ColdPairCap) return Response.json({ error: "That's ten new lookups today. The prepared aisles still work.", code: "cap" }, { status: 503 });
    const code = failCode(err);
    if (code) return Response.json({ error: FAIL_COPY[code], code }, { status: 503 });
    if (err instanceof QuotaError) return Response.json({ error: "Qloo's taste data is busy right now; try again in a minute." }, { status: 503 });
    return Response.json({ error: "Qloo request failed" }, { status: 502 });
  }
}
