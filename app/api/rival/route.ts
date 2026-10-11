import { type NextRequest } from "next/server";
import { RESOLVE_TYPES, QuotaError } from "@/lib/qloo.ts";
import { failCode } from "@/lib/failure.ts";
import { FAIL_COPY } from "@/lib/fail-copy.ts";
import { generationKey } from "@/lib/agent/stream-cache.ts";
import { ColdPairCap, spendColdPair } from "@/lib/rivals.ts";
import { findRival } from "@/lib/rival.ts";
import { methodLine } from "@/lib/vs.ts";

// GET /api/rival?a=<id>&ta=<type> -> { seed, result, line }: the closest same-field brand in the seed's top 50
// (lib/rival.ts). 0 calls when the seed is warm; a cold seed (2 calls) counts as one of the visitor's ten cold pairs.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const id = q.get("a") ?? "", type = q.get("ta") ?? "";
  if (!UUID.test(id) || !RESOLVE_TYPES.includes(type)) return Response.json({ error: "an entity id with its type is required" }, { status: 400 });
  try {
    let r = await findRival(id, type, true);
    if (r === "cold") {
      await spendColdPair(generationKey(request));
      r = await findRival(id, type, false);
    }
    if (!r || r === "cold") return Response.json({ error: "Qloo doesn't know this id" }, { status: 404 });
    return Response.json({ seed: { id, name: r.seed.name, type }, result: r.result, line: methodLine(r.seed.name, r.result) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[rival]", err);
    if (err instanceof ColdPairCap) return Response.json({ error: "That's ten new pairs today. The prepared pairs still work.", code: "cap" }, { status: 503 });
    const code = failCode(err);
    if (code) return Response.json({ error: FAIL_COPY[code], code }, { status: 503 });
    if (err instanceof QuotaError) return Response.json({ error: "Qloo's taste data is busy right now; try again in a minute." }, { status: 503 });
    return Response.json({ error: "Qloo request failed" }, { status: 502 });
  }
}
