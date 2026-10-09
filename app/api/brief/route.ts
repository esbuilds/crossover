import { type NextRequest } from "next/server";
import { brief, CapReached, venuesFor } from "@/lib/agent/brief.ts";
import { generationKey } from "@/lib/agent/stream-cache.ts";
import { loadPair, type PairBody } from "@/lib/pair.ts";
import { QuotaError } from "@/lib/qloo.ts";
import { sse } from "@/lib/sse.ts";
import { peekSharedTags } from "@/lib/fit.ts";
import { failCode } from "@/lib/failure.ts";
import { FAIL_COPY } from "@/lib/fail-copy.ts";

// POST /api/brief {entity, type?, pick, domain} or {proxy: {name, d, p, t?}, pick, domain}
// -> server-sent events: {type:"trace", text} per tool call, {type:"text", delta} as the brief streams, then
//   {type:"venues", market, venues} (price level for the panel), {type:"fit", sharedTags}, then {type:"done", cached} or {type:"error", message} (text that already streamed stays on screen).
export async function POST(request: NextRequest) {
  const pair = await loadPair((await request.json().catch(() => ({}))) as PairBody);
  if ("error" in pair) return Response.json({ error: pair.error }, { status: pair.status });
  const ip = generationKey(request);

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
      const v = await venuesFor(pair, result.trace).catch(() => null);
      if (v?.venues.length) send({ type: "venues", market: v.market, venues: v.venues });
      if (!pair.basedOn?.length) send({ type: "fit", sharedTags: await peekSharedTags(pair.seed, pair.pick).catch(() => []) });
      console.log(`[brief] ${pair.seed.name} x ${pair.pick.name} ${result.ran ? "generated" : "cached"}`, result.ran ? JSON.stringify(result.usage) : "");
      send({ type: "done", cached: !result.ran });
    } catch (err) {
      console.error("[brief]", err);
      const code = failCode(err);
      send({
        type: "error",
        ...(code ? { code } : {}),
        message: code
          ? FAIL_COPY[code]
          : err instanceof CapReached
            ? "You've hit today's limit of 20 new briefs. Briefs you've already opened still work, and the limit resets tomorrow."
            : err instanceof QuotaError
              ? "Qloo's taste data is busy right now. Briefs you've already opened still work; try this one again in a minute."
              : "The brief stopped partway. What's above is what we had; try again to finish it.",
      });
    }
  });
}
