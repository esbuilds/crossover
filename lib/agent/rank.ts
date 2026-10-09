// Ranking agent: Claude Opus 5.5 turns Qloo's raw slate into a partner shortlist with a why-line per pick, and
// drops picks a brand couldn't or shouldn't sign (PLAN.md section 4: deterministic retrieval, agentic reasoning).
// One call per domain, all six in parallel, so why-lines land row by row instead of after one long call.
import { generateText, jsonSchema, Output, type LanguageModelUsage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { cached } from "../qloo.ts";
import { DOMAINS, type Card, type Domain, type Pick, type Slate } from "../slate.ts";

export const MODEL = "claude-opus-5-5";
export type Effort = "low" | "medium";
export const RANK_EFFORT: Effort = "medium"; // Oct 14: low kept a ski resort for Mt. Joy and missed a catski lodge for Liquid Death; medium caught both at similar speed

export type Kept = { entity_id: string; why: string };
export type Dropped = { entity_id: string; name: string; reason: string };
export type DomainRanking = { kept: Kept[]; dropped: Dropped[] };
export type Ranking = Record<Domain, DomainRanking>;

// Who the slate is for. A Qloo entity, or in proxy mode a brand Qloo doesn't know, described by the user and
// seeded by brands its customers also love.
export type Seed = { name: string; kind: string; description?: string; basedOn?: string[] };
export const seedFromCard = (c: Card): Seed => ({ name: c.name, kind: c.type.split(":").pop()!.replace("_", " "), description: c.short_description });

// Stable instructions only, so the prefix is cacheable across all six calls. The picks go in the user turn.
const SYSTEM = `You are the partnerships strategist inside Crossover, a tool that finds collaboration partners for a brand, artist, show, or person using Qloo taste data.

You get a seed and one domain of its slate (brands, artists, TV shows, films, podcasts, or places): up to ten entities that the seed's audience over-indexes on. Each pick has a short id, a name, Qloo affinity (0 to 1, how strongly the seed's fans over-index on it), popularity (0 to 1), a description, and Qloo tags. Some seeds are brands Qloo doesn't know yet; their slate comes from fans of similar brands, which the input names.

Sort the picks into two groups:

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
const refsFor = (domain: Domain, picks: Pick[]) => new Map(picks.map((pick, i) => [`${domain}-${i + 1}`, { domain, pick }] as const));

function userTurn(seed: Seed, domain: Domain, refs: Map<string, PickRef>) {
  const lines = [
    `Seed: ${seed.name} (${seed.kind}). ${seed.description ?? ""}`.trim(),
    ...(seed.basedOn?.length ? [`Qloo doesn't know ${seed.name} yet. This slate comes from fans of: ${seed.basedOn.join(", ")}.`] : []),
    "",
    `## ${domain}`,
  ];
  for (const [id, { pick: p }] of refs)
    lines.push(
      `${id} | ${p.name} | affinity ${p.affinity.toFixed(2)} | popularity ${p.popularity.toFixed(2)} | tags: ${p.tags.join(", ") || "none"} | ${(p.short_description ?? "").slice(0, 160)}`,
    );
  return lines.join("\n");
}

type Raw = { domains: { domain: Domain; kept: { id: string; why: string }[]; dropped: { id: string; reason: string }[] }[] };
type RawDomain = Omit<Raw["domains"][number], "domain">;

const schema = jsonSchema<RawDomain>({
  type: "object",
  additionalProperties: false,
  required: ["kept", "dropped"],
  properties: {
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

export type DomainResult = { ranking: DomainRanking; usage: LanguageModelUsage | null };

export async function rankDomainUncached(seed: Seed, domain: Domain, picks: Pick[], effort: Effort): Promise<DomainResult> {
  const refs = refsFor(domain, picks);
  const { output, usage } = await generateText({
    model: anthropic(MODEL),
    maxOutputTokens: 8000,
    providerOptions: {
      // adaptive thinking is always on for Opus 5.5; effort is the control (its default is medium, so set it).
      // fallbacks: if a safety classifier declines, the API retries on Anthropic's recommended fallback model.
      anthropic: { effort, fallbacks: "default" },
    },
    output: Output.object({ schema }),
    instructions: { role: "system", content: SYSTEM, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages: [{ role: "user", content: userTurn(seed, domain, refs) }],
  });
  return { ranking: toRanking({ domains: [{ domain, ...output }] }, refs)[domain], usage };
}

// Cached 30 days per (seed, domain, picks). The slate is cached too, so this is effectively per entity and domain.
const PROMPT_VERSION = "rank-v2"; // bump to re-rank everything after a prompt change; freezes at checkpoint 2
const rankDomainCached = cached("rank-domain", (_v: string, seed: Seed, domain: Domain, picks: Pick[], effort: Effort) =>
  rankDomainUncached(seed, domain, picks, effort),
);

// All six domains in parallel. onDomain fires as each lands; a failed domain reports null and stays in Qloo's order.
export async function rank(seed: Seed, slate: Slate, onDomain: (d: Domain, r: DomainResult | null) => void, effort: Effort = RANK_EFFORT) {
  await Promise.all(
    DOMAINS.filter((d) => slate[d].length).map(async (d) => {
      try {
        onDomain(d, await rankDomainCached(PROMPT_VERSION, seed, d, slate[d], effort));
      } catch (err) {
        console.error(`[rank] ${d} failed`, err);
        onDomain(d, null);
      }
    }),
  );
}
