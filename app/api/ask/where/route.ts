// GET /api/ask/where?id=<qloo id>&t=<type>[&q=<typed name>|&case=<key>] -> { market, line } for a cached ask's "where
// to start" line, or { line: null }. Cache first; a cold lookup spends one of the visitor's cold allowances.
import { type NextRequest } from "next/server";
import { peekAsk } from "@/lib/ask/agent.ts";
import { bodyFromParams } from "@/lib/ask/body.ts";
import { whereToStart } from "@/lib/ask/where.ts";
import { generationKey } from "@/lib/agent/stream-cache.ts";
import { ColdPairCap } from "@/lib/rivals.ts";

export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const id = sp.id ?? "";
  const body = bodyFromParams(id, sp);
  const events = body ? await peekAsk(body).catch(() => null) : null;
  const seedId = (events?.find((e) => e.type === "result" && e.n === 1) as { output?: { id?: string } } | undefined)?.output?.id;
  if (!events || seedId?.toUpperCase() !== id.toUpperCase()) return Response.json({ line: null }, { status: 404 });
  try {
    return Response.json((await whereToStart(events, generationKey(request))) ?? { line: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // 200: a side line that can't load isn't an error in the visitor's console
    if (err instanceof ColdPairCap) return Response.json({ line: null, error: "cap" });
    console.error("[ask/where]", err);
    return Response.json({ line: null }, { status: 502 });
  }
}
