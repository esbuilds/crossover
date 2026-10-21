// POST /api/ask/second { query } or { id, type } or { case } -> server-sent LookEvents (lib/ask/second.ts), then done or
// error. Only for an ask that is already cached; the frozen answer is never re-run or changed. 404 otherwise.
import { type NextRequest } from "next/server";
import { peekAsk } from "@/lib/ask/agent.ts";
import { parseAskBody } from "@/lib/ask/body.ts";
import { secondLook } from "@/lib/ask/second.ts";
import { CapReached, generationKey } from "@/lib/agent/stream-cache.ts";
import { QuotaError } from "@/lib/qloo.ts";
import { sse } from "@/lib/sse.ts";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const ask = parseAskBody(await request.json().catch(() => null));
  if (!ask || !(await peekAsk(ask).catch(() => null))) return Response.json({ error: "a second look needs an ask that has already run" }, { status: 404 });
  const ip = generationKey(request);
  return sse(async (send) => {
    try {
      const r = await secondLook.look({ ask }, ip, send);
      send({ type: "done", cached: !r.ran });
    } catch (err) {
      console.error("[ask/second]", err);
      send({
        type: "error",
        message: err instanceof CapReached ? "You've hit today's limit of 20 new asks; the frozen answer above still stands."
          : err instanceof QuotaError ? "Qloo's taste data is busy right now; the frozen answer above still stands."
          : "The second look stopped partway; the frozen answer above still stands.",
      });
    }
  });
}
