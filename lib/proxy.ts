// Proxy mode (PLAN.md section 3, proxy fallback): a brand Qloo doesn't know gets its slate from fans of 2-5
// brands Qloo does know. The user names some; Haiku proposes the rest; each goes through match validation.
// A brand-category tag keeps the brand results in the seed's category (stand-ins alone pull toward their own).
import { generateText, jsonSchema, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { brandTag, cached, search, type Tag } from "./qloo.ts";
import { resolve } from "./resolve.ts";
import { toCard, type Card } from "./slate.ts";

import { MAX_PROXIES } from "./proxy-params.ts";
export { weightsFor, parseProxies, formatProxies, MAX_PROXIES } from "./proxy-params.ts";

const PROPOSE = 8; // Haiku proposes this many; we verify in order until MAX_PROXIES pass
const MAX_SEARCHES = 10; // hard cap on Qloo searches per proposal, user-named brands included

// --- proposal: Haiku suggests brands Qloo likely knows; the user's own names always come first ---

type Proposal = { categories: string[]; industry: string; candidates: { name: string; why: string }[] };
const INDUSTRIES = ["food and beverage", "health and beauty", "fashion", "household", "electronics", "sports and outdoors", "media and entertainment"];
const schema = jsonSchema<Proposal>({
  type: "object",
  additionalProperties: false,
  required: ["categories", "industry", "candidates"],
  properties: {
    categories: {
      type: "array",
      description: "Up to three short phrases for what the brand sells, broadest first, as a store aisle would say it (for example 'seafood', then 'canned fish'). Empty if unclear.",
      items: { type: "string" },
    },
    industry: { type: "string", enum: INDUSTRIES, description: "The broad industry the brand belongs to" },
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

async function propose(name: string, description: string, named: string[]): Promise<Proposal> {
  if (!process.env.ANTHROPIC_API_KEY) return { categories: [], industry: "", candidates: [] };
  const { output } = await generateText({
    model: anthropic("claude-haiku-5-5"),
    providerOptions: { anthropic: { effort: "low" } },
    output: Output.object({ schema }),
    prompt: `A brand called "${name}" isn't in our taste database yet. The owner describes it as: "${description || "no description given"}".${
      named.length ? ` They say their customers also love: ${named.join(", ")}.` : ""
    }

Suggest ${PROPOSE} brands its customers most likely also buy, best first. The taste database behind this knows national lifestyle and direct-to-consumer brands well (kitchen and home, food and drink, apparel, beauty, wellness) and knows grocery staples and store labels poorly. Prefer brands with a strong identity and a national following, in the same or adjacent categories, over same-shelf grocery labels. Do not repeat the brands the owner already named, and do not suggest ${name} itself. If the description is too vague to tell what ${name} sells, suggest fewer or none rather than guessing.

Also give up to three category phrases for what ${name} sells, broadest first (a broad aisle like "seafood", "snacks", "beverages", "skincare" before anything specific), and its industry.`,
  });
  return { categories: output.categories.map((c) => c.trim()).filter(Boolean).slice(0, 3), industry: output.industry, candidates: output.candidates.slice(0, PROPOSE) };
}

export type ProxyResult = { proxies: Card[]; rejected: { name: string; reason: string }[]; proposed: string[]; tag: Tag | null; guessed: boolean };

async function verify(c: string): Promise<Card | { name: string; reason: string }> {
  const r = await resolve(c, await search(c, ["urn:entity:brand"], 5));
  if (r.status !== "confident") return { name: c, reason: r.status === "ambiguous" ? "several possible matches in Qloo" : "not in Qloo" };
  if (r.match.popularity < 0.3) return { name: c, reason: "too obscure in Qloo to steer a slate" };
  return toCard(r.match, "urn:entity:brand");
}

// The user's names first, then Haiku's, verified in order (a few at a time) until MAX_PROXIES pass or
// MAX_SEARCHES run out. Each verification is one Qloo search; the category tag is one more.
async function proposeUncached(name: string, description: string, named: string[]): Promise<ProxyResult> {
  const mine = [...new Set(named.map((n) => n.trim()).filter(Boolean))].slice(0, 3);
  const proposal = await propose(name, description, mine);
  const queue = [...mine, ...proposal.candidates.map((s) => s.name)]
    .filter((c, i, all) => all.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i && c.toLowerCase() !== name.toLowerCase())
    .slice(0, MAX_SEARCHES);

  // first category phrase that maps to a Qloo brand tag, then the industry level ("olive oil" has no brand tag,
  // "food and beverage" does); at most 4 calls, usually 1
  const tag = (async () => {
    for (const c of [...proposal.categories, proposal.industry].filter(Boolean)) {
      const t = await brandTag(c).catch(() => null);
      if (t) return t;
    }
    return null;
  })();
  const proxies: Card[] = [];
  const rejected: { name: string; reason: string }[] = [];
  while (queue.length && proxies.length < MAX_PROXIES) {
    const batch = queue.splice(0, MAX_PROXIES - proxies.length);
    for (const r of await Promise.all(batch.map(verify))) {
      if (!("entity_id" in r)) rejected.push(r);
      else if (proxies.length < MAX_PROXIES && !proxies.some((p) => p.entity_id === r.entity_id)) proxies.push(r);
    }
  }
  return { proxies, rejected, proposed: proposal.candidates.map((s) => s.name), tag: await tag, guessed: mine.length === 0 };
}

// Cached 30 days per (name, description, named brands) so "Check again" and share links are stable.
const PROPOSAL_VERSION = "proxies-v5";
const proposeCached = cached("proxies", (_v: string, name: string, description: string, named: string[]) => proposeUncached(name, description, named));
export const proposeProxies = (name: string, description: string, named: string[]) =>
  proposeCached(PROPOSAL_VERSION, name.trim(), description.trim(), named.map((n) => n.trim()).filter(Boolean));
