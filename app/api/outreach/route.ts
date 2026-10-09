import { type NextRequest } from "next/server";
import { outreach } from "@/lib/agent/outreach.ts";
import { CapReached } from "@/lib/agent/stream-cache.ts";
import { loadPair, type PairBody } from "@/lib/pair.ts";
import { sse } from "@/lib/sse.ts";

// POST /api/outreach, same body as /api/brief -> server-sent events with the email: {type:"text", delta}, then
// {type:"done"} or {type:"error"}. Called only after a human approves the brief. Nothing is sent anywhere.
export async function POST(request: NextRequest) {
  const pair = await loadPair((await request.json().catch(() => ({}))) as PairBody);
  if ("error" in pair) return Response.json({ error: pair.error }, { status: pair.status });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

  return sse(async (send) => {
    try {
      const result = await outreach(
        pair,
        ip,
        () => {},
        (delta) => send({ type: "text", delta }),
      );
      if (!result.ran) send({ type: "text", delta: result.text });
      console.log(`[outreach] ${pair.seed.name} x ${pair.pick.name} ${result.ran ? "generated" : "cached"}`, result.ran ? JSON.stringify(result.usage) : "");
      send({ type: "done", cached: !result.ran });
    } catch (err) {
      console.error("[outreach]", err);
      send({
        type: "error",
        message: err instanceof CapReached ? "You've hit today's limit of 20 new drafts. The limit resets tomorrow." : "The email stopped partway. Try again to finish it.",
      });
    }
  });
}
