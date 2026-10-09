import { type NextRequest } from "next/server";
import { fitPair } from "@/lib/pairing.ts";
import { getCard, isEntityType } from "@/lib/slate.ts";
import { badgeFor } from "@/lib/fit.ts";
import { QuotaError } from "@/lib/qloo.ts";
import { sse } from "@/lib/sse.ts";
import { bucketFor, contrastPlay, parseNames, sortRows } from "@/lib/triage.ts";
import { triageTable, type TriageFact, type TriageTable } from "@/lib/agent/triage.ts";
import { CapReached, generationKey } from "@/lib/agent/stream-cache.ts";
import { failCode } from "@/lib/failure.ts";
import { FAIL_COPY } from "@/lib/fail-copy.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/triage?seed=<id>&t=<type>&n=<id>:<type>,... (up to 15) -> server-sent events:
// {type:"seed", card}, then one {type:"row", ...} per name in the order given (fit both ways, overlap, bucket decided
// in code), then {type:"table", summary, reasons} (one Opus call, triage-v1), then {type:"done"}.
// Names are checked one at a time, so a 15-name paste never fans out against Qloo.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const seedId = q.get("seed") ?? "";
  const seedType = q.get("t");
  const names = parseNames(q.get("n"));
  if (!UUID.test(seedId) || !isEntityType(seedType) || !names) return Response.json({ error: "seed, t and n (up to 15 id:type pairs) are required" }, { status: 400 });
  const others = names.filter((x) => x.id.toLowerCase() !== seedId.toLowerCase());
  const ip = generationKey(request);

  return sse(async (send) => {
    const fail = (err: unknown, fallback: string) => {
      const code = failCode(err);
      send({
        type: "error",
        ...(code ? { code } : {}),
        message: code ? FAIL_COPY[code] : err instanceof QuotaError ? "Qloo's taste data is busy right now; try this triage again in a minute." : fallback,
      });
    };
    try {
      const seed = await getCard(seedId, seedType);
      if (!seed) return send({ type: "error", message: "Qloo has no entity with that id" });
      send({ type: "seed", card: seed });

      const facts: (TriageFact & { popularity: number })[] = [];
      for (const n of others) {
        try {
          const fit = await fitPair({ id: seed.entity_id, type: seed.type }, n);
          if (!fit) {
            send({ type: "row", id: n.id, missing: true });
            continue;
          }
          const { input, heatmapMissing } = fit;
          const nameAmongSeed = input.bAmongA.rank;
          const seedAmongName = input.aAmongB.rank;
          const bucket = bucketFor(nameAmongSeed, seedAmongName);
          const top = input.overlap[0];
          const fact = {
            id: n.id,
            name: input.b.name,
            type: input.b.type,
            bucket,
            contrast: contrastPlay(bucket, input.b.popularity, input.overlap.length),
            nameAmongSeed,
            seedAmongName,
            topMarket: top ? { market: top.market, seed: top.seed_over_index, name: top.partner_over_index } : null,
            sharedTags: input.sharedTags,
            popularity: input.b.popularity,
          };
          facts.push(fact);
          send({ ...fact, entityType: fact.type, type: "row", card: input.b, badge: badgeFor(seedAmongName), heatmapMissing, affinity: input.bAmongA.affinity ?? 0, tags: input.bAmongA.tags.slice(0, 5) });
        } catch (err) {
          if (failCode(err) || err instanceof QuotaError) throw err; // out of credit or over the cap: stop the triage
          console.error("[triage] row", n.id, err);
          send({ type: "row", id: n.id, failed: true });
        }
      }

      if (facts.length) {
        try {
          const result = await triageTable({ seed, rows: sortRows(facts).map(({ popularity: _p, ...f }) => f) }, ip, () => {}, () => {}); // eslint-disable-line @typescript-eslint/no-unused-vars
          const table: TriageTable = JSON.parse(result.text);
          send({ type: "table", ...table });
        } catch (err) {
          console.error("[triage] table", err);
          const code = failCode(err);
          send({
            type: "table_error",
            message: code ? FAIL_COPY[code] : err instanceof CapReached ? "You've hit today's limit of 20 new briefs and triages. The table above stands; the reasons come back tomorrow." : "The reasons didn't come through. The buckets above are from Qloo and stand on their own.",
          });
        }
      }
      send({ type: "done" });
    } catch (err) {
      console.error("[triage]", err);
      fail(err, "Something failed during the triage");
    }
  });
}
