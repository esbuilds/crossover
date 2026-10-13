import { ogCard } from "@/lib/og.tsx";
import { peekAsk } from "@/lib/ask/agent.ts";
import { parseAskBody } from "@/lib/ask/body.ts";
import { unbracket } from "@/lib/ask/check.ts";
import { cardsStep, stepsFrom } from "@/lib/ask/steps.ts";

// GET /ask/<id>/og?t=<type>: a shared ask's preview card, from the cached decision only (never a call). The first call
// and its measured score, as the page shows them; a missing or blocked decision falls back to the question alone.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = parseAskBody({ id, type: new URL(request.url).searchParams.get("t") ?? "urn:entity:brand" });
  const events = body ? await peekAsk(body).catch(() => null) : null;
  const steps = events ? stepsFrom(events) : [];
  const seed = (steps.find((s) => s.tool === "resolve")?.output as { name?: string } | undefined)?.name;
  const d = events?.findLast((e) => e.type === "decision");
  const first = d && d.type === "decision" && d.check.ok ? d.decision?.calls[0] : undefined;
  const score = first ? cardsStep(steps)?.cards.find((c) => c.name === unbracket(first.name))?.affinity : undefined;
  const res = await ogCard({
    title: seed ? `Who should ${seed} call first?` : "Who should they call first?",
    line: first ? `1. ${unbracket(first.name)}${score != null ? ` ${score.toFixed(2)}` : ""}. Every line checked against the Qloo step behind it.` : "One name in. An agent measures in Qloo, step by step, and says who to call first.",
  });
  res.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
  return res;
}
