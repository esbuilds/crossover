import { type NextRequest } from "next/server";
import { DOMAINS, getSlate, getCard, toCard, type Domain, type Slate, type Card } from "@/lib/slate.ts";
import { fixtureById } from "@/lib/fixtures.ts";
import { brief, CapReached } from "@/lib/agent/brief.ts";
import { parseProxies } from "@/lib/proxy.ts";
import { parseTag } from "@/lib/proxy-params.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/brief {entity, type?, pick, domain}                 a Qloo entity
// POST /api/brief {proxy: {name, d, p}, pick, domain}            proxy mode
// -> server-sent events: {type:"trace", text} per tool call, {type:"text", delta} as the brief streams, then
//   {type:"done", cached} or {type:"error", message}. Entity and pick data are looked up server-side from the cached
//   slate. The only caller text that reaches the prompt is a proxy-mode brand's own name and description, length-capped.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { entity, type, pick, domain, proxy } = body as {
    entity?: string;
    type?: string;
    pick?: string;
    domain?: Domain;
    proxy?: { name?: string; d?: string; p?: string; t?: string };
  };
  const signals = parseProxies(typeof proxy?.p === "string" ? proxy.p : null);
  const proxyName = typeof proxy?.name === "string" ? proxy.name.trim().slice(0, 80) : "";
  if (!(UUID.test(entity ?? "") || (signals && proxyName)) || !pick || !UUID.test(pick) || !domain || !DOMAINS.includes(domain))
    return Response.json({ error: "entity (or proxy), pick, and domain are required" }, { status: 400 });

  let seed: Card | null;
  let slate: Slate;
  let anchor: Card | undefined;
  let basedOn: string[] | undefined;
  if (signals) {
    const cards = await Promise.all(signals.map((s) => getCard(s.id, "urn:entity:brand"))); // cached since the run
    if (cards.some((c) => !c)) return Response.json({ error: "Unknown proxy" }, { status: 404 });
    anchor = cards[0]!;
    basedOn = cards.map((c) => c!.name);
    seed = { entity_id: "proxy", name: proxyName, type: "proxy", popularity: 0, short_description: typeof proxy?.d === "string" ? proxy.d.trim().slice(0, 300) : undefined };
    slate = await getSlate(signals, undefined, parseTag(typeof proxy?.t === "string" ? proxy.t : null)); // same args as the run, so cached
  } else {
    const fx = fixtureById(entity!);
    if (fx && fx.resolution.status === "confident") [seed, slate] = [toCard(fx.resolution.match), fx.slate];
    else [seed, slate] = await Promise.all([getCard(entity!, type), getSlate(entity!)]); // both cached since the run
  }
  const picks = slate[domain];
  const at = picks.findIndex((p) => p.entity_id === pick);
  if (!seed || at < 0) return Response.json({ error: "That pick isn't in this slate" }, { status: 404 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const encoder = new TextEncoder();
  // Work runs detached from start(): a stream whose async start() hasn't settled serves no reads.
  const stream = new ReadableStream({
    start(controller) {
      void work(controller);
    },
  });

  async function work(controller: ReadableStreamDefaultController) {
    const send = (event: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    try {
      const input = { seed: seed!, pick: picks[at], domain: domain!, slateRank: at + 1, slateSize: picks.length, anchor, basedOn };
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
      console.log(`[brief] ${seed!.name} x ${picks[at].name} ${result.ran ? "generated" : "cached"}`, result.ran ? JSON.stringify(result.usage) : "");
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

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
