// GET /api/ask/smaller?id=<qloo id>&t=<type>[&q=<typed name>|&case=<key>] -> smaller names within 0.05 of the leader for a
// cached ask, or { smaller: null }. Cache first; a cold seed spends one of the visitor's cold allowances, then 2 calls.
import { type NextRequest } from "next/server";
import { peekAsk } from "@/lib/ask/agent.ts";
import { bodyFromParams } from "@/lib/ask/body.ts";
import { smaller } from "@/lib/ask/smaller.ts";
import { generationKey } from "@/lib/agent/stream-cache.ts";
import { ColdPairCap } from "@/lib/rivals.ts";

export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const id = sp.id ?? "";
  const body = bodyFromParams(id, sp);
  const events = body ? await peekAsk(body).catch(() => null) : null;
  const seedId = (events?.find((e) => e.type === "result" && e.n === 1) as { output?: { id?: string } } | undefined)?.output?.id;
  if (!events || seedId?.toUpperCase() !== id.toUpperCase()) return Response.json({ smaller: null }, { status: 404 });
  try {
    return Response.json({ smaller: await smaller(events, generationKey(request)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // 200: a side line that can't load isn't an error in the visitor's console
    if (err instanceof ColdPairCap) return Response.json({ smaller: null, error: "cap" });
    console.error("[ask/smaller]", err);
    return Response.json({ smaller: null }, { status: 502 });
  }
}
