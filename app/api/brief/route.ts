import { type NextRequest } from "next/server";
import { brief, CapReached } from "@/lib/agent/brief.ts";
import { loadPair, type PairBody } from "@/lib/pair.ts";
import { QuotaError } from "@/lib/qloo.ts";
import { sse } from "@/lib/sse.ts";

// POST /api/brief {entity, type?, pick, domain} or {proxy: {name, d, p, t?}, pick, domain}
// -> server-sent events: {type:"trace", text} per tool call, {type:"text", delta} as the brief streams, then
//   {type:"done", cached} or {type:"error", message} (text that already streamed stays on screen).
export async function POST(request: NextRequest) {
  const pair = await loadPair((await request.json().catch(() => ({}))) as PairBody);
  if ("error" in pair) return Response.json({ error: pair.error }, { status: pair.status });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

  return sse(async (send) => {
    try {
      const result = await brief(
        pair,
        ip,
        (text) => send({ type: "trace", text }),
        (delta) => send({ type: "text", delta }),
      );
      if (!result.ran) {
        // cache hit: replay what the original run showed
        for (const text of result.trace) send({ type: "trace", text });
        send({ type: "text", delta: result.text });
      }
      console.log(`[brief] ${pair.seed.name} x ${pair.pick.name} ${result.ran ? "generated" : "cached"}`, result.ran ? JSON.stringify(result.usage) : "");
      send({ type: "done", cached: !result.ran });
    } catch (err) {
      console.error("[brief]", err);
      send({
        type: "error",
        message:
          err instanceof CapReached
            ? "You've hit today's limit of 20 new briefs. Briefs you've already opened still work, and the limit resets tomorrow."
            : err instanceof QuotaError
              ? "Qloo's taste data is busy right now. Briefs you've already opened still work; try this one again in a minute."
              : "The brief stopped partway. What's above is what we had; try again to finish it.",
      });
    }
  });
}
