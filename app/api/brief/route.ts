import { type NextRequest } from "next/server";
import {
  DOMAINS,
  getSlate,
  getCard,
  toCard,
  type Domain,
  type Slate,
  type Card,
} from "@/lib/slate.ts";
import { fixtureById } from "@/lib/fixtures.ts";
import { brief, CapReached } from "@/lib/agent/brief.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/brief {entity, type?, pick, domain} -> server-sent events:
//   {type:"trace", text} per tool call, {type:"text", delta} as the brief streams, then {type:"done", cached}
//   or {type:"error", message}. Only ids come from the client; names and numbers are looked up server-side
//   from the cached slate, so nothing a caller sends ends up in the prompt.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { entity, type, pick, domain } = body as {
    entity?: string;
    type?: string;
    pick?: string;
    domain?: Domain;
  };
  if (
    !entity ||
    !UUID.test(entity) ||
    !pick ||
    !UUID.test(pick) ||
    !domain ||
    !DOMAINS.includes(domain)
  )
    return Response.json(
      { error: "entity, pick, and domain are required" },
      { status: 400 },
    );

  let seed: Card | null;
  let slate: Slate;
  const fx = fixtureById(entity);
  if (fx && fx.resolution.status === "confident")
    [seed, slate] = [toCard(fx.resolution.match), fx.slate];
  else
    [seed, slate] = await Promise.all([
      getCard(entity, type),
      getSlate(entity),
    ]); // both cached since the run
  const picks = slate[domain];
  const at = picks.findIndex((p) => p.entity_id === pick);
  if (!seed || at < 0)
    return Response.json(
      { error: "That pick isn't in this entity's slate" },
      { status: 404 },
    );

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const encoder = new TextEncoder();
  // Work runs detached from start(): a stream whose async start() hasn't settled serves no reads, which would
  // buffer every event until the end.
  const stream = new ReadableStream({
    start(controller) {
      void work(controller);
    },
  });
  async function work(controller: ReadableStreamDefaultController) {
    const send = (event: object) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    try {
      const input = {
        seed: seed!,
        pick: picks[at],
        domain: domain!,
        slateRank: at + 1,
        slateSize: picks.length,
      };
      const result = await brief(
        input,
        ip,
        (text) => send({ type: "trace", text }),
        (delta) => send({ type: "text", delta }),
      );
      if (!result.ran) {
        // cache hit: replay what the original run showed
        for (const text of result.trace) send({ type: "trace", text });
        send({ type: "text", delta: result.text });
      }
      console.log(
        `[brief] ${seed!.name} x ${picks[at].name} ${result.ran ? "generated" : "cached"}`,
        result.ran ? JSON.stringify(result.usage) : "",
      );
      send({ type: "done", cached: !result.ran });
    } catch (err) {
      console.error("[brief]", err);
      send({
        type: "error",
        message:
          err instanceof CapReached
            ? "You've hit today's limit of 20 new briefs. Briefs you've already opened still work, and the limit resets tomorrow."
            : "Couldn't write this brief right now. Try again in a minute.",
      });
    } finally {
      controller.close();
    }
  }
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
