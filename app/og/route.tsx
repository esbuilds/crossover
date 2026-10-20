import { ogCard } from "@/lib/og.tsx";
import { parseShare, shareCard } from "@/lib/review-share.ts";
import { TOOL_LABEL } from "@/lib/ask/sheet.ts";

// GET /og[?<share query>]: the site's default preview card (the front door), or a Pick three share link's. Built from the query
// alone: no Qloo call, no cache read.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const one = (k: string) => q.get(k) ?? undefined;
  const shared = parseShare({ c: one("c"), p: one("p"), g: one("g"), s: one("s"), n: q.getAll("n") });
  // no share query: the site's own card, the front door's line (the ask since Pick A, Oct 13) (Pick three links keep their card)
  const res = await ogCard(shared ? shareCard(shared) : { title: "One name in. Who should they call first?", line: "An agent measures in Qloo step by step and says who to call first, with every line checked against the step behind it", rail: Object.values(TOOL_LABEL) });
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  return res;
}
