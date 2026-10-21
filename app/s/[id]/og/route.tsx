import { ogCard } from "@/lib/og.tsx";
import { peekCard } from "@/lib/slate.ts";
import { peekTopMarket } from "@/lib/cities.ts";

// GET /s/<id>/og?t=<type>: the share link's preview card. Cache-only reads: a crawler never spends a Qloo call, and
// an id that isn't cached gets the generic card.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = new URL(request.url).searchParams.get("t") ?? "";
  const [card, top] = await Promise.all([peekCard(id, t).catch(() => null), peekTopMarket(id).catch(() => null)]);
  const res = await ogCard(
    card
      ? { title: `Partners for ${card.name}`, line: top ? `Top market: ${top.name}, ${top.overIndex} against a US average of 100` : undefined }
      : { title: "The full partner list" },
  );
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  return res;
}
