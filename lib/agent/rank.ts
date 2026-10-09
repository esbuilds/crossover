// Ranking agent: Claude Opus 5.5 reviews Qloo's raw slate one domain at a time, writes a why-line per pick, and
// drops or demotes picks a partner couldn't or shouldn't sign (PLAN.md section 4: deterministic retrieval,
// agentic reasoning). All six domains run in parallel, so why-lines land row by row.
// rank-v3 (Oct 17): the order is Qloo's affinity order, set in code. The model can only drop or demote a pick,
// always with a stated reason, never promote one, so the scorecard's "#N of 10" matches the card order.
import { generateText, jsonSchema, Output, type LanguageModelUsage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { cached } from "../qloo.ts";
import { playbookFor } from "../playbook.ts";
import { DOMAINS, type Card, type Domain, type Pick, type Slate } from "../slate.ts";

export const MODEL = "claude-opus-5-5";
export type Effort = "low" | "medium";
export const RANK_EFFORT: Effort = "medium"; // Oct 14: low kept a ski resort for Mt. Joy and missed a catski lodge for Liquid Death; medium caught both at similar speed

export type Kept = { entity_id: string; why: string; demoted?: string; competitor?: true; excluded?: true };
export type Dropped = { entity_id: string; name: string; reason: string };
// kept: up to five, affinity order. demoted: workable but weaker, each with its reason, shown after the shortlist.
export type DomainRanking = { kept: Kept[]; demoted: Kept[]; dropped: Dropped[] };
export type Ranking = Record<Domain, DomainRanking>;

// Who the slate is for. A Qloo entity, or in proxy mode a brand Qloo doesn't know, described by the user and
// seeded by brands its customers also love. type picks the playbook (brand, artist, tv_show, movie, person).
export type Seed = { name: string; kind: string; type: string; description?: string; basedOn?: string[] };
export const seedFromCard = (c: Card): Seed => ({
  name: c.name,
  kind: playbookFor(c.type).noun,
  type: c.type,
  description: c.short_description,
});

// Stable per seed type, so the prefix caches across all six calls. The picks go in the user turn.
const system = (type: string) => {
  const p = playbookFor(type);
  return `You are the partnerships strategist inside Crossover, a tool that finds collaboration partners using Qloo taste data.

${p.rankGuidance} A partner here is a ${p.partnerRole}.

You get a seed and one domain of its slate (brands, artists, TV shows, films, podcasts, or places): up to ten entities that the seed's audience over-indexes on, listed in Qloo's affinity order (highest first). Each pick has a short id, a name, Qloo affinity (0 to 1, how strongly the seed's fans over-index on it), popularity (0 to 1), a description, and Qloo tags. Some seeds are brands Qloo doesn't know yet; their slate comes from fans of similar brands, which the input names.

Affinity is the order. Your job is to review each pick, not to re-rank. For every pick, give exactly one decision:

keep: a workable partner. Write a why-line.
demote: workable but clearly weaker as a partner than its affinity suggests (for example a generic retailer, a weak fit for this kind of seed). Write a why-line and a short reason for the demotion. Demoted picks move below the kept ones.
competitor: a direct competitor of the seed (same category, same shelf, same customer). Still useful to see, so it is shown below the shortlist with a competitor label. Write a why-line (what the overlap tells the seed) and a short reason.
excluded: only when the user gave constraints. The pick breaks one of them (for example a beer brand when the user said no alcohol) even though Qloo's filters let it through. It is shown below the shortlist labeled "excluded by constraint". Give the reason naming the constraint.
drop: off-brand or unworkable as a partner: a controversial or polarizing figure the seed would not want to stand next to, a deceased artist, a generic place like a chain hotel or a ski resort when the seed is not a travel brand, a film decades old with no active brand, anything that would embarrass either side. Give a reason of a few words.

Default to keep. Never demote a pick just because another one fits better; demote or drop only for a reason you can state about that pick.

Why-lines:
- Written for a partnerships lead, not an engineer. Plain words, no jargon, no numbers.
- Under 20 words.
- Cite a specific Qloo tag the pick carries or a trait it plainly shares with the seed.
- Say why the pairing works, not what the pick is.

Use the short ids exactly as given. Do not invent picks.`;
};

type PickRef = { domain: Domain; pick: Pick };

// Short ids ("brand-3") keep the prompt small and make hallucinated ids easy to reject.
const refsFor = (domain: Domain, picks: Pick[]) => new Map<string, PickRef>(picks.map((pick, i) => [`${domain}-${i + 1}`, { domain, pick }]));

function userTurn(seed: Seed, domain: Domain, refs: Map<string, PickRef>, constraints?: string) {
  const lines = [
    ...(constraints ? [`The user refined this slate with: "${constraints}". Qloo filters already applied what they could; drop any pick that still clearly breaks the constraints, and let why-lines reflect them. A region means where to launch, never where a partner is based.`, ""] : []),
    `Seed: ${seed.name} (${seed.kind}). ${seed.description ?? ""}`.trim(),
    ...(seed.basedOn?.length ? [`Qloo doesn't know ${seed.name} yet. This slate comes from fans of: ${seed.basedOn.join(", ")}.`] : []),
    "",
    `## ${domain}, in affinity order`,
  ];
  for (const [id, { pick: p }] of refs)
    lines.push(
      `${id} | ${p.name} | affinity ${p.affinity.toFixed(2)} | popularity ${p.popularity.toFixed(2)} | tags: ${p.tags.join(", ") || "none"} | ${(p.short_description ?? "").slice(0, 160)}`,
    );
  return lines.join("\n");
}

type Decision = { id: string; decision: "keep" | "demote" | "competitor" | "excluded" | "drop"; why: string; reason: string };
type RawDomain = { picks: Decision[] };

const schema = jsonSchema<RawDomain>({
  type: "object",
  additionalProperties: false,
  required: ["picks"],
  properties: {
    picks: {
      type: "array",
      description: "One entry per pick",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "decision", "why", "reason"],
        properties: {
          id: { type: "string" },
          decision: { type: "string", enum: ["keep", "demote", "competitor", "excluded", "drop"] },
          why: { type: "string", description: "Why-line for keep or demote, under 20 words. Empty for drop." },
          reason: { type: "string", description: "Short reason for demote, competitor, or drop. Empty for keep." },
        },
      },
    },
  },
});

// Turn the model's decisions into the shortlist. Code owns the order: affinity order (the slate's order) with
// demoted picks after kept ones, top five. Unknown and duplicate ids are discarded, and a demote or drop with no
// reason counts as keep, so the model can't silently reorder.
export function toRanking(domain: Domain, picks: Pick[], decisions: Decision[]): DomainRanking {
  const refs = refsFor(domain, picks);
  const byId = new Map<string, Decision>();
  for (const d of decisions) if (refs.has(d.id) && !byId.has(d.id)) byId.set(d.id, d);
  const order = [...refs.keys()]; // affinity order
  const decided = order.map((id) => {
    const d = byId.get(id);
    const decision = d && d.decision !== "keep" && !d.reason.trim() ? "keep" : (d?.decision ?? "keep");
    return { id, pick: refs.get(id)!.pick, decision, why: d?.why ?? "", reason: d?.reason ?? "" };
  });
  // A pick the model skipped stays as keep in its affinity place (shown without a why-line); otherwise a skip
  // would let a lower pick move up, which is a promotion by omission.
  const keep = decided.filter((d) => d.decision === "keep");
  // competitors are demotions with a label: visible below the shortlist, never dropped
  const demote = decided.filter((d) => d.decision === "demote" || d.decision === "competitor" || d.decision === "excluded");
  return {
    kept: keep.slice(0, 5).map((d) => ({ entity_id: d.pick.entity_id, why: d.why })),
    demoted: demote.map((d) => ({
      entity_id: d.pick.entity_id,
      why: d.why,
      demoted: d.reason,
      ...(d.decision === "competitor" ? { competitor: true as const } : {}),
      ...(d.decision === "excluded" ? { excluded: true as const } : {}),
    })),
    dropped: decided.filter((d) => d.decision === "drop").map((d) => ({ entity_id: d.pick.entity_id, name: d.pick.name, reason: d.reason })),
  };
}

export type DomainResult = { ranking: DomainRanking; usage: LanguageModelUsage | null };

export async function rankDomainUncached(seed: Seed, domain: Domain, picks: Pick[], effort: Effort, constraints?: string): Promise<DomainResult> {
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
    instructions: { role: "system", content: system(seed.type), providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages: [{ role: "user", content: userTurn(seed, domain, refs, constraints) }],
  });
  return { ranking: toRanking(domain, picks, output.picks), usage };
}

// Cached 30 days per (seed, domain, picks). The slate is cached too, so this is effectively per entity and domain.
const REFINED_VERSION = "rank-v3.4"; // refined runs only. v3.4: regions stripped, "where to launch" line. v3.3: "excluded by constraint" outcome
const PROMPT_VERSION = "rank-v3.2"; // v3.2: competitor outcome (demoted with a label). v3.1: demoted picks get their own list. bump to re-rank everything after a prompt change; freezes at checkpoint 2
// constraints is only passed for refined runs, so unrefined cache keys are unchanged.
const rankDomainCached = cached("rank-domain", (_v: string, seed: Seed, domain: Domain, picks: Pick[], effort: Effort, ...rest: [string?]) =>
  rankDomainUncached(seed, domain, picks, effort, rest[0]),
);

// All six domains in parallel. onDomain fires as each lands; a failed domain reports null and stays in Qloo's order.
export async function rank(seed: Seed, slate: Slate, onDomain: (d: Domain, r: DomainResult | null) => void, effort: Effort = RANK_EFFORT, constraints?: string) {
  await Promise.all(
    DOMAINS.filter((d) => slate[d].length).map(async (d) => {
      try {
        // refined runs use their own label (the "excluded" outcome, Oct 20) so unrefined rankings stay cached
        onDomain(d, await (constraints ? rankDomainCached(REFINED_VERSION, seed, d, slate[d], effort, constraints) : rankDomainCached(PROMPT_VERSION, seed, d, slate[d], effort)));
      } catch (err) {
        console.error(`[rank] ${d} failed`, err);
        onDomain(d, null);
      }
    }),
  );
}
