import { ogCard } from "@/lib/og.tsx";
import { parseShare, shareCard } from "@/lib/review-share.ts";

// GET /og[?<share query>]: the site's default preview card (the front door), or a Pick three share link's. Built from the query
// alone: no Qloo call, no cache read.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const one = (k: string) => q.get(k) ?? undefined;
  const shared = parseShare({ c: one("c"), p: one("p"), g: one("g"), s: one("s"), n: q.getAll("n") });
  // no share query: the site's own card, the front door's line (Pick three links keep their card)
  const res = await ogCard(shared ? shareCard(shared) : { title: "Two names in. See where their audiences split.", line: "One US map of where each audience over-indexes, and which brands sit closer to each side, from Qloo affinity and heatmaps" });
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  return res;
}
