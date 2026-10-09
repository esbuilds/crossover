import { type NextRequest } from "next/server";
import { search, RESOLVE_TYPES } from "@/lib/qloo.ts";
import { resolve, type Resolution } from "@/lib/resolve.ts";
import { toCard } from "@/lib/slate.ts";
import { fixtureByQuery } from "@/lib/fixtures.ts";

// GET /api/resolve?q=<text> -> { status, candidates }
// Confident: candidates[0] is the match, the rest are what "Not it" offers. Ambiguous: up to three to pick from.
const shape = (r: Resolution) => ({
  status: r.status,
  candidates: r.status === "confident" ? [r.match, ...r.alternates].map((e) => toCard(e)) : r.status === "ambiguous" ? r.candidates.map((e) => toCard(e)) : [],
});

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q || q.length > 100) return Response.json({ error: "q must be 1 to 100 characters" }, { status: 400 });

  const fx = fixtureByQuery(q);
  if (fx) {
    console.log(`[resolve] "${q}" from fixture`);
    return Response.json({ ...shape(fx.resolution), source: "fixture" }, { headers: { "Cache-Control": "no-store" } });
  }

  console.log(`[resolve] "${q}" from Qloo`);
  try {
    const r = await resolve(q, await search(q, RESOLVE_TYPES, 5));
    return Response.json({ ...shape(r), source: "qloo" }, { headers: { "Cache-Control": "public, s-maxage=2592000" } });
  } catch (err) {
    console.error("[resolve]", err);
    return Response.json({ error: "Qloo request failed" }, { status: 502 });
  }
}
