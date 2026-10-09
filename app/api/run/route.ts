import { type NextRequest } from "next/server";
import {
  getSlate,
  orderSlate,
  getCard,
  toCard,
  DOMAINS,
  type Domain,
  type Pick,
  type Slate,
  type Card,
} from "@/lib/slate.ts";
import { getCities, buildCities, type Cities } from "@/lib/cities.ts";
import { fixtureById } from "@/lib/fixtures.ts";
import { rank } from "@/lib/agent/rank.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LABEL: Record<Domain, string> = {
  brand: "brands",
  artist: "artists",
  tv_show: "TV shows",
  movie: "films",
  podcast: "podcasts",
  place: "places",
};

// GET /api/run?entity=<id>[&type=<hint>] -> server-sent events, each a JSON object:
//   {type:"trace", text} as each step happens, {type:"slate", data} once retrieval is done (the UI renders it
//   right away), {type:"ranking", data} when the agent finishes, then {type:"done"} or {type:"error", message}.
// Qloo retrieval is the same as /api/slate; this endpoint just reports it as it happens.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("entity") ?? "";
  const type = request.nextUrl.searchParams.get("type");
  if (!UUID.test(id))
    return Response.json(
      { error: "entity must be a Qloo entity id" },
      { status: 400 },
    );

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
    const trace = (text: string) => send({ type: "trace", text });
    try {
      let entity: Card | null;
      let slate: Slate;
      let cities: Cities;
      const onDomain = (d: Domain, picks: Pick[]) =>
        trace(`Got ${picks.length} ${LABEL[d]} their fans over-index on`);
      const onCities = (c: Cities) =>
        trace(
          `Mapped ${c.cellCount.toLocaleString()} heatmap cells to ${c.marketCount} US markets; hottest is ${c.metros[0]?.name ?? "unclear"}`,
        );

      const fx = fixtureById(id);
      if (fx && fx.resolution.status === "confident") {
        console.log(`[run] ${id} from fixture (${fx.query})`);
        entity = toCard(fx.resolution.match);
        trace(`Found ${entity.name} in Qloo`);
        slate = fx.slate;
        DOMAINS.forEach((d) => onDomain(d, slate[d]));
        cities = buildCities(fx.heatmap);
        onCities(cities);
      } else {
        console.log(`[run] ${id} from Qloo`);
        const card = getCard(id, type).then(
          (c) => (c && trace(`Found ${c.name} in Qloo`), c),
        );
        const geo = getCities(id).then((c) => (onCities(c), c));
        [entity, slate, cities] = await Promise.all([
          card,
          getSlate(id, onDomain),
          geo,
        ]);
        if (!entity) throw new Error("Qloo has no entity with that id");
      }

      send({
        type: "slate",
        data: { entity, domains: orderSlate(slate), cities },
      });

      trace("Asking Claude to shortlist partners a brand could actually sign");
      try {
        const started = Date.now();
        const { ranking, usage } = await rank(entity, slate);
        const kept = Object.values(ranking).reduce(
          (n, r) => n + r.kept.length,
          0,
        );
        const dropped = Object.values(ranking).reduce(
          (n, r) => n + r.dropped.length,
          0,
        );
        console.log(
          `[run] ranked ${entity.name} in ${Date.now() - started} ms`,
          JSON.stringify(usage),
        );
        trace(
          `Shortlisted ${kept} partners and dropped ${dropped} that don't fit`,
        );
        send({ type: "ranking", data: ranking });
      } catch (err) {
        // the slate is already on screen; a failed ranking leaves it unranked instead of erroring the page
        console.error("[run] ranking failed", err);
        trace("Couldn't shortlist right now; showing Qloo's order");
      }
      send({ type: "done" });
    } catch (err) {
      console.error("[run]", err);
      send({
        type: "error",
        message:
          err instanceof Error && err.message.startsWith("Qloo has no")
            ? err.message
            : "Something failed while building the slate",
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
