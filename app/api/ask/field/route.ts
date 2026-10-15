// GET /api/ask/field?id=<qloo id>&t=<type>[&q=<typed name>|&case=<key>] -> the field notes for a cached ask, or
// { notes: null }. Cache first; a cold lookup spends one of the visitor's cold allowances.
import { type NextRequest } from "next/server";
import { peekAsk } from "@/lib/ask/agent.ts";
import { bodyFromParams } from "@/lib/ask/body.ts";
import { fieldNotesFor } from "@/lib/ask/field-notes.ts";
import { generationKey } from "@/lib/agent/stream-cache.ts";
import { ColdPairCap } from "@/lib/rivals.ts";

export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const id = sp.id ?? "";
  const body = bodyFromParams(id, sp);
  const events = body ? await peekAsk(body).catch(() => null) : null;
  const seedId = (events?.find((e) => e.type === "result" && e.n === 1) as { output?: { id?: string } } | undefined)?.output?.id;
  if (!events || seedId?.toUpperCase() !== id.toUpperCase()) return Response.json({ notes: null }, { status: 404 });
  try {
    return Response.json({ notes: await fieldNotesFor(events, generationKey(request)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ColdPairCap) return Response.json({ notes: null, error: "cap" }, { status: 503 });
    console.error("[ask/field]", err);
    return Response.json({ notes: null }, { status: 502 });
  }
}
