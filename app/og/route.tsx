import { ogCard } from "@/lib/og.tsx";
import { parseShare, shareCard } from "@/lib/review-share.ts";

// GET /og[?<share query>]: the site's default preview card, or a Pick three share link's. Built from the query
// alone: no Qloo call, no cache read.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const one = (k: string) => q.get(k) ?? undefined;
  const res = await ogCard(shareCard(parseShare({ c: one("c"), p: one("p"), g: one("g"), s: one("s"), n: q.getAll("n") })));
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  return res;
}
