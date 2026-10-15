// GET /api/ask/both?id=<qloo id>&t=<type>[&q=<typed name>|&case=<key>] -> the "both ways" table for a cached ask, or
// { both: null }. Cache first; a cold ask spends one of the visitor's cold allowances, then up to 8 calls.
import { type NextRequest } from "next/server";
import { peekAsk } from "@/lib/ask/agent.ts";
import { bodyFromParams } from "@/lib/ask/body.ts";
import { bothWays } from "@/lib/ask/both-ways.ts";
import { generationKey } from "@/lib/agent/stream-cache.ts";
import { ColdPairCap } from "@/lib/rivals.ts";

export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const id = sp.id ?? "";
  const body = bodyFromParams(id, sp);
  const events = body ? await peekAsk(body).catch(() => null) : null;
  const seedId = (events?.find((e) => e.type === "result" && e.n === 1) as { output?: { id?: string } } | undefined)?.output?.id;
  if (!events || seedId?.toUpperCase() !== id.toUpperCase()) return Response.json({ both: null }, { status: 404 });
  try {
    return Response.json({ both: await bothWays(events, generationKey(request)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ColdPairCap) return Response.json({ both: null, error: "cap" }, { status: 503 });
    console.error("[ask/both]", err);
    return Response.json({ both: null }, { status: 502 });
  }
}
