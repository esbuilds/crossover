import { ogCard, ogMapCard } from "@/lib/og.tsx";
import { mapSvg } from "@/lib/og-map.ts";
import { peekVs } from "@/lib/rivals.ts";
import { mapLine } from "@/lib/vs.ts";
import { TONE } from "@/lib/collide.ts";
import { isEntityType } from "@/lib/slate.ts";

// GET /vs/<idA>/<idB>/og?ta=&tb=: the share card is the map (brief-oct12-front). Cache only: a crawler never spends a
// Qloo call. A pair that isn't fully cached, or a person pair with no map, gets the text card.
export async function GET(request: Request, { params }: { params: Promise<{ a: string; b: string }> }) {
  const { a, b } = await params;
  const q = new URL(request.url).searchParams;
  const [ta, tb] = [q.get("ta"), q.get("tb")];
  const d = isEntityType(ta) && isEntityType(tb) ? await peekVs({ id: a, type: ta }, { id: b, type: tb }).catch(() => null) : null;
  const warm = d && d !== "cold" ? d : null;
  const res = warm?.map
    ? await ogMapCard({
        title: `${warm.a.name} vs ${warm.b.name}`,
        line: mapLine(warm.a.name, warm.b.name, warm.map),
        svg: mapSvg(warm.map),
        legend: [
          { color: TONE.a, label: `Leans ${warm.a.name}` },
          { color: TONE.b, label: `Leans ${warm.b.name}` },
          { color: TONE.both, label: "Both" },
        ],
      })
    : await ogCard(warm ? { title: `${warm.a.name} vs ${warm.b.name}`, line: "Where two audiences split" } : { title: "Where two audiences split" });
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  return res;
}
