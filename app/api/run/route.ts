import { type NextRequest } from "next/server";
import {
  getSlate,
  orderSlate,
  getCard,
  toCard,
  isEntityType,
  DOMAINS,
  type Domain,
  type Pick,
  type Slate,
  type Card,
  type RefineHook,
} from "@/lib/slate.ts";
import { getCities, buildCities, type Cities } from "@/lib/cities.ts";
import { fixtureById } from "@/lib/fixtures.ts";
import { rank, seedFromCard, type Seed } from "@/lib/agent/rank.ts";
import { parseProxies } from "@/lib/proxy.ts";
import { parseTag } from "@/lib/proxy-params.ts";
import { QuotaError } from "@/lib/qloo.ts";
import { interpret, refineParams, relaxedParams, appliedSentence, type ConstraintSet } from "@/lib/refine.ts";
import { rankAmongFans, badgeFor } from "@/lib/fit.ts";
import { brandTrends } from "@/lib/trends.ts";
import { failCode } from "@/lib/failure.ts";
import { FAIL_COPY } from "@/lib/fail-copy.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LABEL: Record<Domain, string> = {
  brand: "brands",
  artist: "artists",
  tv_show: "TV shows",
  movie: "films",
  podcast: "podcasts",
  place: "places",
};

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
  const refineText = (q.get("c") ?? "").trim().slice(0, 200); // refine: one sentence of constraints
  if (!(UUID.test(id) && isEntityType(q.get("type"))) && !(proxies && name))
    return Response.json(
      {
        error:
          "Pass entity=<Qloo id> and type=<urn:entity:...>, or name and p=<id:weight,...> for proxy mode",
      },
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
    const onDomain = (d: Domain, picks: Pick[]) =>
      trace(`Got ${picks.length} ${LABEL[d]} their fans over-index on`);
    const onCities = (c: Cities) =>
      trace(
        `Mapped ${c.cellCount.toLocaleString()} heatmap cells to ${c.marketCount} US markets; hottest is ${c.metros[0]?.name ?? "unclear"}`,
      );
    try {
      let entity: Card;
      let seed: Seed;
      let slate: Slate;
      let cities: Cities;
      let basedOn: Card[] = [];
      let constraints: ConstraintSet | null = null;

      // Refine: read the sentence into a constraint set and say what was understood before retrieval starts.
      const refineFor = async (
        seedName: string,
        kind: string,
      ): Promise<RefineHook> => {
        trace("Reading your constraints");
        const set = await interpret(seedName, kind, refineText);
        constraints = set;
        trace(set.summary.replace(/^Reading your constraints: /, "Applying: "));
        if (set.notes.length) trace(`Couldn't apply: ${set.notes.join("; ")}`);
        send({ type: "constraints", data: set });
        return {
          paramsFor: (d) => refineParams(set, d),
          relaxedFor: (d) => relaxedParams(set, d),
          excludeIds: set.excludeIds,
          onNote: trace,
        };
      };

      if (proxies) {
        console.log(`[run] proxy "${name}" from Qloo`, JSON.stringify(proxies));
        // names for the banner; the cards are cached after the first load of this proxy set
        basedOn = (
          await Promise.all(
            proxies.map((p) => getCard(p.id, "urn:entity:brand")),
          )
        ).filter((c): c is Card => !!c);
        if (basedOn.length !== proxies.length)
          throw new Error("Qloo has no entity with one of those ids");
        trace(
          `Building ${name}'s slate from fans of ${basedOn.map((c) => c.name).join(", ")}`,
        );
        entity = {
          entity_id: "proxy",
          name,
          type: "proxy",
          popularity: 0,
          short_description: description || undefined,
        };
        seed = {
          name,
          kind: "brand",
          type: "proxy",
          description,
          basedOn: basedOn.map((c) => c.name),
        };
        const hook = refineText ? await refineFor(name, "brand") : null;
        const states = (constraints as ConstraintSet | null)?.states;
        [slate, cities] = await Promise.all([
          getSlate(proxies, onDomain, tag, hook),
          getCities(proxies, states).then((c) => (onCities(c), c)),
        ]);
      } else {
        const fx = refineText ? null : fixtureById(id); // fixtures hold unrefined slates only
        if (fx && fx.resolution.status === "confident") {
          console.log(`[run] ${id} from fixture (${fx.query})`);
          entity = toCard(fx.resolution.match);
          trace(`Found ${entity.name} in Qloo`);
          slate = fx.slate;
          DOMAINS.forEach((d) => onDomain(d, slate[d]));
          cities = buildCities(fx.heatmap);
          onCities(cities);
        } else if (refineText) {
          // refined: the card first (cached), since interpreting the sentence needs the seed's name and type
          console.log(`[run] ${id} refined from Qloo: ${refineText}`);
          const c = await getCard(id, q.get("type"));
          if (!c) throw new Error("Qloo has no entity with that id");
          trace(`Found ${c.name} in Qloo`);
          const hook = await refineFor(c.name, seedFromCard(c).kind);
          const states = (constraints as ConstraintSet | null)?.states;
          [entity, slate, cities] = [
            c,
            ...(await Promise.all([
              getSlate(id, onDomain, null, hook),
              getCities(id, states).then((g) => (onCities(g), g)),
            ])),
          ];
        } else {
          console.log(`[run] ${id} from Qloo`);
          const card = getCard(id, q.get("type")).then(
            (c) => (c && trace(`Found ${c.name} in Qloo`), c),
          );
          const geo = getCities(id).then((c) => (onCities(c), c));
          const [c, s, g] = await Promise.all([
            card,
            getSlate(id, onDomain),
            geo,
          ]);
          if (!c) throw new Error("Qloo has no entity with that id");
          [entity, slate, cities] = [c, s, g];
        }
        seed = seedFromCard(entity);
      }

      send({
        type: "slate",
        data: { entity, basedOn, domains: orderSlate(slate), cities },
      });

      trace(
        constraints
          ? "Checking each pick against your constraints, usually 10 to 20 seconds"
          : "Shortlisting, usually 10 to 20 seconds",
      );
      const started = Date.now();
      let kept = 0;
      let dropped = 0;
      let failed = 0;
      let topBrands: string[] = [];
      let keptBrands: string[] = [];
      let creditNoted = false;
      await rank(
        seed,
        slate,
        (d, r, err) => {
          if (d === "brand" && r) {
            topBrands = r.ranking.kept.slice(0, 3).map((k) => k.entity_id);
            keptBrands = r.ranking.kept.map((k) => k.entity_id);
          }
          if (!r) {
            failed++;
            // out of credit: one calm line for the whole slate, not six
            if (failCode(err) === "credit") {
              if (!creditNoted) trace("The shortlisting agent is out of credit right now, so the slate shows Qloo's order");
              creditNoted = true;
            } else trace(`Couldn't shortlist ${LABEL[d]} right now; showing Qloo's order`);
            return;
          }
          kept += r.ranking.kept.length;
          dropped += r.ranking.dropped.length;
          send({ type: "ranking", domain: d, data: r.ranking });
          console.log(
            `[run] ranked ${seed.name} ${d} at ${Date.now() - started} ms`,
            JSON.stringify(r.usage),
          );
        },
        undefined,
        // only what actually applied: unmapped phrases were reported as not applied, so the ranker doesn't see them
        (constraints as ConstraintSet | null) ? appliedSentence(constraints as unknown as ConstraintSet) || undefined : undefined,
      );
      trace(
        `Shortlisted ${kept} partners and dropped ${dropped} that don't fit${failed ? ` (${failed} categories unranked)` : ""}`,
      );

      // Rank badges: where does the seed rank among each top brand's fans' picks? 1 Qloo call per brand, cached and shared
      // with the brief's reverse check. Proxy seeds have no Qloo id to look for, so they get none.
      if (!proxies && topBrands.length) {
        trace("Checking where you rank among each top brand's fans' picks");
        try {
          const ranks = await Promise.all(
            topBrands.map((b) => rankAmongFans(entity, b)),
          );
          const badges = Object.fromEntries(
            topBrands.map((b, i) => [b, badgeFor(ranks[i].rank)]),
          );
          send({ type: "mutual", data: badges });
        } catch (err) {
          console.error("[run] mutual badges failed", err); // badges are a bonus; the slate stands without them
        }
      }
      // Moment vs durable: the brand list again with trend lift off and at very high. 2 Qloo calls per seed, cached.
      // Off by default since Oct 23: on the hackathon API, trends off returned the default list for every demo seed,
      // so the chips said nothing. CROSSOVER_TRENDS=on brings it back. Unrefined runs only.
      if (process.env.CROSSOVER_TRENDS === "on" && !constraints && keptBrands.length) {
        trace("Checking which brands hold up without trend lift");
        try {
          send({ type: "trends", data: await brandTrends(proxies ?? id, keptBrands, slate.brand.map((p) => p.entity_id), tag) });
        } catch (err) {
          console.error("[run] trends failed", err); // a bonus, like the badges
        }
      }
      send({ type: "done" });
    } catch (err) {
      console.error("[run]", err);
      const code = failCode(err);
      send({
        type: "error",
        ...(code ? { code } : {}),
        message: code
          ? FAIL_COPY[code]
          : err instanceof QuotaError
            ? "Qloo's taste data is busy right now. Names you've already looked up still load; try a new one in a minute."
            : err instanceof Error && err.message.startsWith("Qloo has no")
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
