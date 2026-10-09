// Proxy mode (PLAN.md section 3, proxy fallback): a brand Qloo doesn't know gets its slate from fans of 2-5
// brands Qloo does know. The user names some; Haiku proposes the rest; each goes through match validation.
import { generateText, jsonSchema, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { search } from "./qloo.ts";
import { resolve } from "./resolve.ts";
import { toCard, type Card } from "./slate.ts";

import { MAX_PROXIES } from "./proxy-params.ts";
export { weightsFor, parseProxies, formatProxies, MAX_PROXIES } from "./proxy-params.ts";

// --- proposal: Haiku suggests brands Qloo likely knows; the user's own names always come first ---

type Proposal = { candidates: { name: string; why: string }[] };
const schema = jsonSchema<Proposal>({
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "why"],
        properties: { name: { type: "string", description: "Exact brand name" }, why: { type: "string", description: "A few words" } },
      },
    },
  },
});

async function propose(name: string, description: string, named: string[], want: number): Promise<{ name: string; why: string }[]> {
  if (want <= 0 || !process.env.ANTHROPIC_API_KEY) return [];
  const { output } = await generateText({
    model: anthropic("claude-haiku-5-5"),
    providerOptions: { anthropic: { effort: "low" } },
    output: Output.object({ schema }),
    prompt: `A brand called "${name}" isn't in our taste database yet. The owner describes it as: "${description || "no description given"}".${
      named.length ? ` They say their customers also love: ${named.join(", ")}.` : ""
    }

Suggest ${want} brands its customers most likely also buy. The taste database behind this knows national lifestyle and direct-to-consumer brands well (kitchen and home, food and drink, apparel, beauty, wellness) and knows grocery staples and store labels poorly. So prefer brands with a strong identity and a national following, in adjacent categories that share ${name}'s customer, over same-shelf grocery labels. For example, an olive oil brand's customers also buy design-led cookware, premium pantry and drinks brands, and kitchen tools. Do not repeat the brands the owner already named, and do not suggest ${name} itself. If the description is too vague to tell what ${name} sells, suggest fewer or none rather than guessing.`,
  });
  return output.candidates.slice(0, want);
}

export type ProxyResult = { proxies: Card[]; rejected: { name: string; reason: string }[]; proposed: string[] };

// Up to MAX_PROXIES candidates: the user's names first, Haiku fills the rest. Each costs one Qloo search.
// Keep only confident brand matches with popularity at least 0.3 (PLAN.md section 3).
export async function proposeProxies(name: string, description: string, named: string[]): Promise<ProxyResult> {
  const mine = [...new Set(named.map((n) => n.trim()).filter(Boolean))].slice(0, 3);
  const suggested = await propose(name, description, mine, MAX_PROXIES - mine.length);
  const candidates = [...mine, ...suggested.map((s) => s.name)].filter((c, i, all) => all.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i);

  const checked = await Promise.all(
    candidates.map(async (c) => {
      const r = await resolve(c, await search(c, ["urn:entity:brand"], 5));
      if (r.status !== "confident") return { name: c, reason: r.status === "ambiguous" ? "several possible matches in Qloo" : "not in Qloo" };
      if (r.match.popularity < 0.3) return { name: c, reason: "too obscure in Qloo to steer a slate" };
      return toCard(r.match, "urn:entity:brand");
    }),
  );
  const proxies = checked.filter((c): c is Card => "entity_id" in c).filter((c, i, all) => all.findIndex((x) => x.entity_id === c.entity_id) === i);
  return { proxies, rejected: checked.filter((c): c is { name: string; reason: string } => !("entity_id" in c)), proposed: suggested.map((s) => s.name) };
}
