// app/api/ask/route.ts
// POST /api/ask { query } or { id, type } -> server-sent AskEvents (lib/ask/agent.ts), then done or error.
import { type NextRequest } from "next/server";
import { ask } from "@/lib/ask/agent.ts";
import { CapReached, generationKey } from "@/lib/agent/stream-cache.ts";
import { QuotaError } from "@/lib/qloo.ts";
import { ColdPairCap } from "@/lib/rivals.ts";
import { failCode } from "@/lib/failure.ts";
import { FAIL_COPY } from "@/lib/fail-copy.ts";
import { sse } from "@/lib/sse.ts";
import { parseAskBody } from "@/lib/ask/body.ts";

// a cold ask runs about 40 s; the stalled outage drill ran 70 (Fable, Oct 15): an explicit limit, not the plan default
export const maxDuration = 120;


export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const input = parseAskBody(body);
  if (!input) return Response.json({ error: "a name is required" }, { status: 400 });
  const ip = generationKey(request);
  return sse(async (send) => {
    try {
      const r = await ask(input, ip, send);
      console.log(`[ask] ${input.query ?? input.id} ${r.ran ? "generated" : "cached"}`);
      send({ type: "done", cached: !r.ran });
    } catch (err) {
      console.error("[ask]", err);
      const code = failCode(err);
      send({
        type: "error",
        message: code ? FAIL_COPY[code]
          : err instanceof CapReached ? "You've hit today's limit of 20 new asks. Asks you've already opened still work, and the limit resets tomorrow."
          : err instanceof QuotaError || err instanceof ColdPairCap ? "Qloo's taste data is busy right now. Prepared asks still work; try this one again in a minute."
          : "The agent stopped partway. The steps below are what it measured; try again to finish.",
      });
    }
  });
}
