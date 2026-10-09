import { type NextRequest } from "next/server";
import { getSlate, orderSlate, getCard, toCard, DOMAINS, type Domain, type Pick, type Slate, type Card } from "@/lib/slate.ts";
import { getCities, buildCities, type Cities } from "@/lib/cities.ts";
import { fixtureById } from "@/lib/fixtures.ts";
import { rank, seedFromCard, type Seed } from "@/lib/agent/rank.ts";
import { parseProxies } from "@/lib/proxy.ts";
import { parseTag } from "@/lib/proxy-params.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LABEL: Record<Domain, string> = { brand: "brands", artist: "artists", tv_show: "TV shows", movie: "films", podcast: "podcasts", place: "places" };

// GET /api/run?entity=<id>[&type=<hint>]                        a Qloo entity
// GET /api/run?name=<typed name>&d=<description>&p=<id:10,id:7>[&t=<brand tag>]  proxy mode: a brand Qloo doesn't know
// -> server-sent events, each a JSON object:
//   {type:"trace", text} as each step happens; {type:"slate", data} once retrieval is done (the UI renders it right
//   away); {type:"ranking", domain, data} per domain as each ranking call lands; then {type:"done"} or {type:"error"}.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const id = q.get("entity") ?? "";
  const proxies = parseProxies(q.get("p"));
  const name = (q.get("name") ?? "").trim().slice(0, 80);
  const description = (q.get("d") ?? "").trim().slice(0, 300);
  const tag = parseTag(q.get("t")); // proxy mode: brand-category tag
  if (!UUID.test(id) && !(proxies && name))
    return Response.json({ error: "Pass entity=<Qloo id>, or name and p=<id:weight,...> for proxy mode" }, { status: 400 });

  const encoder = new TextEncoder();
  // Work runs detached from start(): a stream whose async start() hasn't settled serves no reads, which would
  // buffer every event until the end.
  const stream = new ReadableStream({
    start(controller) {
      void work(controller);
    },
  });

  async function work(controller: ReadableStreamDefaultController) {
    const send = (event: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    const trace = (text: string) => send({ type: "trace", text });
    const onDomain = (d: Domain, picks: Pick[]) => trace(`Got ${picks.length} ${LABEL[d]} their fans over-index on`);
    const onCities = (c: Cities) =>
      trace(`Mapped ${c.cellCount.toLocaleString()} heatmap cells to ${c.marketCount} US markets; hottest is ${c.metros[0]?.name ?? "unclear"}`);
    try {
      let entity: Card;
      let seed: Seed;
      let slate: Slate;
      let cities: Cities;
      let basedOn: Card[] = [];

      if (proxies) {
        console.log(`[run] proxy "${name}" from Qloo`, JSON.stringify(proxies));
        // names for the banner; the cards are cached after the first load of this proxy set
        basedOn = (await Promise.all(proxies.map((p) => getCard(p.id, "urn:entity:brand")))).filter((c): c is Card => !!c);
        if (basedOn.length !== proxies.length) throw new Error("Qloo has no entity with one of those ids");
        trace(`Building ${name}'s slate from fans of ${basedOn.map((c) => c.name).join(", ")}`);
        entity = { entity_id: "proxy", name, type: "proxy", popularity: 0, short_description: description || undefined };
        seed = { name, kind: "brand", description, basedOn: basedOn.map((c) => c.name) };
        [slate, cities] = await Promise.all([getSlate(proxies, onDomain, tag), getCities(proxies).then((c) => (onCities(c), c))]);
      } else {
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
          const card = getCard(id, q.get("type")).then((c) => (c && trace(`Found ${c.name} in Qloo`), c));
          const geo = getCities(id).then((c) => (onCities(c), c));
          const [c, s, g] = await Promise.all([card, getSlate(id, onDomain), geo]);
          if (!c) throw new Error("Qloo has no entity with that id");
          [entity, slate, cities] = [c, s, g];
        }
        seed = seedFromCard(entity);
      }

      send({ type: "slate", data: { entity, basedOn, domains: orderSlate(slate), cities } });

      trace("Asking Claude to shortlist partners a brand could actually sign, one category at a time");
      const started = Date.now();
      let kept = 0;
      let dropped = 0;
      let failed = 0;
      await rank(seed, slate, (d, r) => {
        if (!r) {
          failed++;
          trace(`Couldn't shortlist ${LABEL[d]} right now; showing Qloo's order`);
          return;
        }
        kept += r.ranking.kept.length;
        dropped += r.ranking.dropped.length;
        send({ type: "ranking", domain: d, data: r.ranking });
        console.log(`[run] ranked ${seed.name} ${d} at ${Date.now() - started} ms`, JSON.stringify(r.usage));
      });
      trace(`Shortlisted ${kept} partners and dropped ${dropped} that don't fit${failed ? ` (${failed} categories unranked)` : ""}`);
      send({ type: "done" });
    } catch (err) {
      console.error("[run]", err);
      send({ type: "error", message: err instanceof Error && err.message.startsWith("Qloo has no") ? err.message : "Something failed while building the slate" });
    } finally {
      controller.close();
    }
  }

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
