// Ranking agent: one Claude Opus 5.5 call that turns Qloo's raw slate into a partner shortlist with a why-line
// per pick, and drops picks a brand couldn't or shouldn't sign (PLAN.md section 4: deterministic retrieval,
// agentic reasoning). Retrieval is cached, so the agent always sees the same evidence for an entity.
import { generateText, jsonSchema, Output, type LanguageModelUsage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { cached } from "../qloo.ts";
import { DOMAINS, type Card, type Domain, type Pick, type Slate } from "../slate.ts";

export const MODEL = "claude-opus-5-5";

export type Kept = { entity_id: string; why: string };
export type Dropped = { entity_id: string; name: string; reason: string };
export type Ranking = Record<Domain, { kept: Kept[]; dropped: Dropped[] }>;
export type RankResult = { ranking: Ranking; usage: LanguageModelUsage | null };

// Stable instructions only, so the prefix is cacheable. The slate goes in the user turn.
const SYSTEM = `You are the partnerships strategist inside Crossover, a tool that finds collaboration partners for a brand, artist, show, or person using Qloo taste data.

You get a seed entity and its slate: for each domain (brands, artists, TV shows, films, podcasts, places), up to ten entities that the seed's audience over-indexes on. Each pick has a short id, a name, Qloo affinity (0 to 1, how strongly the seed's fans over-index on it), popularity (0 to 1), a description, and Qloo tags.

For every domain, sort the picks into two groups:

kept: up to five picks, best first. A good pick is one a partnerships lead could actually sign and build a collab around: a real brand, creator, show, film, podcast, or venue with a clear audience overlap and a plausible joint idea. Prefer picks with a sharp, specific link to the seed over generic ones. Affinity is evidence, not the ranking: a slightly lower affinity pick that fits the brand beats a higher one that doesn't.

dropped: picks that are off-brand or unworkable as a partner. Examples: a controversial or polarizing figure the seed's brand would not want to stand next to, a deceased artist, a generic place like a chain hotel or a ski resort when the seed is not a travel brand, a film that is decades old with no active brand, anything that would embarrass either side. Each dropped pick gets a reason of a few words.

Picks you neither keep nor drop are fine to leave out; they stay visible below the shortlist without a why-line.

Each kept pick gets a why-line:
- Written for a partnerships lead, not an engineer. Plain words, no jargon, no numbers.
- Under 20 words.
- Cites a specific Qloo tag the pick carries or a trait it plainly shares with the seed.
- Says why the pairing works, not what the pick is.

Use the short ids exactly as given. Do not invent picks.`;

type PickRef = { domain: Domain; pick: Pick };

// Short ids ("brand-3") keep the prompt small and make hallucinated ids easy to reject.
function index(slate: Slate) {
  const refs = new Map<string, PickRef>();
  for (const domain of DOMAINS) slate[domain].forEach((pick, i) => refs.set(`${domain}-${i + 1}`, { domain, pick }));
  return refs;
}

function userTurn(seed: Card, refs: Map<string, PickRef>) {
  const lines = [`Seed: ${seed.name} (${seed.type.split(":").pop()}). ${seed.short_description ?? ""}`.trim(), ""];
  for (const domain of DOMAINS) {
    const picks = [...refs].filter(([, r]) => r.domain === domain);
    if (!picks.length) continue;
    lines.push(`## ${domain}`);
    for (const [id, { pick: p }] of picks)
      lines.push(
        `${id} | ${p.name} | affinity ${p.affinity.toFixed(2)} | popularity ${p.popularity.toFixed(2)} | tags: ${p.tags.join(", ") || "none"} | ${(p.short_description ?? "").slice(0, 160)}`,
      );
    lines.push("");
  }
  return lines.join("\n");
}

type Raw = { domains: { domain: Domain; kept: { id: string; why: string }[]; dropped: { id: string; reason: string }[] }[] };

const schema = jsonSchema<Raw>({
  type: "object",
  additionalProperties: false,
  required: ["domains"],
  properties: {
    domains: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["domain", "kept", "dropped"],
        properties: {
          domain: { type: "string", enum: [...DOMAINS] },
          kept: {
            type: "array",
            description: "Up to five, best first",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "why"],
              properties: { id: { type: "string" }, why: { type: "string", description: "Under 20 words, for a partnerships lead" } },
            },
          },
          dropped: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "reason"],
              properties: { id: { type: "string" }, reason: { type: "string" } },
            },
          },
        },
      },
    },
  },
});

// Map the model's short ids back to entities. Unknown ids, cross-domain ids, and duplicates are discarded,
// and kept is capped at five, so a sloppy response can't put a pick that Qloo never returned on screen.
export function toRanking(raw: Raw, refs: Map<string, PickRef>): Ranking {
  const ranking = Object.fromEntries(DOMAINS.map((d) => [d, { kept: [], dropped: [] }])) as unknown as Ranking;
  const seen = new Set<string>();
  for (const d of raw.domains) {
    if (!DOMAINS.includes(d.domain)) continue;
    const ok = (id: string) => refs.get(id)?.domain === d.domain && !seen.has(id) && seen.add(id);
    for (const k of d.kept) if (ranking[d.domain].kept.length < 5 && ok(k.id)) ranking[d.domain].kept.push({ entity_id: refs.get(k.id)!.pick.entity_id, why: k.why });
    for (const x of d.dropped) if (ok(x.id)) ranking[d.domain].dropped.push({ entity_id: refs.get(x.id)!.pick.entity_id, name: refs.get(x.id)!.pick.name, reason: x.reason });
  }
  return ranking;
}

async function rankUncached(seed: Card, slate: Slate): Promise<RankResult> {
  const refs = index(slate);
  const { output, usage } = await generateText({
    model: anthropic(MODEL),
    maxOutputTokens: 16000,
    providerOptions: {
      // adaptive thinking is always on for Opus 5.5; effort is the control. Its default is medium, set explicitly.
      // fallbacks: if a safety classifier declines, the API retries on Anthropic's recommended fallback model.
      anthropic: { effort: "medium", fallbacks: "default" },
    },
    output: Output.object({ schema }),
    instructions: { role: "system", content: SYSTEM, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages: [
      { role: "user", content: userTurn(seed, refs) },
    ],
  });
  return { ranking: toRanking(output, refs), usage };
}

// Cached 30 days per (seed, slate). The slate is itself cached, so this is effectively per entity.
const PROMPT_VERSION = "rank-v1"; // bump to re-rank everything after a prompt change
const rankCached = cached("rank", (version: string, seed: Card, slate: Slate) => rankUncached(seed, slate));
export const rank = (seed: Card, slate: Slate) => rankCached(PROMPT_VERSION, seed, slate);
