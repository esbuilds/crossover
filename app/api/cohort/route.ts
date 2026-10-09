import { type NextRequest } from "next/server";
import { loadPair, type PairBody } from "@/lib/pair.ts";
import { getCohort, peekCohort } from "@/lib/cohort.ts";
import { QuotaError } from "@/lib/qloo.ts";

// POST /api/cohort {same body as /api/brief, peek?: true} -> {cohort} or {cohort: null} on a peek miss.
// peek reads the cache only (0 Qloo calls), so an opened brief shows a chart that was already run.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as PairBody & { peek?: boolean };
  const pair = await loadPair(body);
  if ("error" in pair) return Response.json({ error: pair.error }, { status: pair.status });
  const input = { seedName: pair.seed.name, seedSignal: pair.seedSignal, partner: { entity_id: pair.pick.entity_id, name: pair.pick.name, type: pair.pick.type } };
  try {
    return Response.json({ cohort: body.peek ? await peekCohort(input) : await getCohort(input) });
  } catch (err) {
    console.error("[cohort]", err);
    const busy = err instanceof QuotaError;
    return Response.json({ error: busy ? "Qloo's taste data is busy right now; try this again in a minute." : "Couldn't break this down by age right now." }, { status: busy ? 503 : 500 });
  }
}
