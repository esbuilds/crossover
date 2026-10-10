// Brief agent: a tool-using Claude Opus 5.5 loop that checks a pairing both ways in Qloo, finds where both
// audiences run hot and where to launch, then writes a partnership one-pager (PLAN.md section 2, step 6).
import { streamText, jsonSchema, tool, isStepCount, type LanguageModelUsage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { insights, insightsPost, placeTag, tags, type Signal } from "../qloo.ts";
import { playbookFor } from "../playbook.ts";
import { getCities } from "../cities.ts";
import { overlapMarkets } from "../overlap.ts";
import { rankAmongFans } from "../fit.ts";
import type { Card, Pick } from "../slate.ts";
import { MODEL } from "./rank.ts";
import { streamCache, type Streamed } from "./stream-cache.ts";
import { forced } from "../force.ts";

// seedSignal: the seed's entity id, or its weighted proxies. In proxy mode the seed is synthetic (Qloo doesn't
// know it); anchor is the top-weighted proxy, which stands in for the seed in the reverse check.
export type BriefInput = {
  seed: Card;
  seedSignal: string | Signal[];
  pick: Pick;
  domain: string; // a slate domain, or "person" for a pairing-mode partner
  // fromSlate: the partner is in the seed's slate (#slateRank of slateSize). Otherwise it came from pairing mode and
  // slateRank is its rank among the seed's fans' top 50 in its category, or null when outside it.
  slateRank: number | null;
  slateSize: number;
  fromSlate?: boolean;
  anchor?: Card;
  basedOn?: string[];
  region?: { label: string; states: string[] }; // refined runs: the markets tools only return markets in these states
  constraints?: string; // refined runs: the applied constraints (appliedSentence), so venues that break them are skipped
  noBars?: boolean; // an applied exclusion covers alcohol: the venue tool asks for cafes and coffee shops instead of bars
};
export type BriefResult = Streamed & { usage: LanguageModelUsage | null };

// One prompt shape for every seed type; the playbook (lib/playbook.ts) fills in what a partner and a launch mean.
const system = (seedType: string) => {
  const p = playbookFor(seedType);
  return `You are the partnerships strategist inside Crossover. A partnerships lead picked a potential partner from a slate Qloo built for a ${p.noun} (the seed). Here a partner is a ${p.partnerRole}. Your job: check where each ranks among the other's fans with Qloo, find where to launch, then write a one-page brief they could forward to their boss.

Playbook, in this order:
1. Call qloo_reverse_affinity. Forward fit (how much the seed's fans over-index on the partner) is already given to you as a slate rank. The reverse call tells you where the seed ranks among the partner's fans' top 50 in the seed's category, plus both entities' tags. A pairing ranked in only one list is a weaker pitch; say so.
2. Call qloo_heatmap_overlap. It returns the US markets in both audiences' top tens with each side's over-index (100 is the US average). Pick the market: the overlap market with the highest combined over-index. If there is no overlap, or the partner has no heatmap, use the seed's top market and say so.
3. Call qloo_places_in_city for that market. It returns venues both audiences over-index on. If it reports it fell back to another market, use that market and say why.
4. Optionally call qloo_tags once if a shared theme needs grounding in Qloo's tag vocabulary.
5. Write the brief. Use only facts from the input and the tool results. Never invent numbers, sales figures, past collabs, venues, tour dates, or quotes.

Some seeds are brands Qloo doesn't know yet. Then the input says so, names the brands whose fans the slate was built from, and names one of them as the stand-in. In that case: say "based on fans of" those brands where you cite the slate rank, and write the reverse rank line as "- Ranked both ways, measured against <stand-in> fans: ..." using the stand-in's name, because the reverse check measured the stand-in, not the seed.

Write the brief in plain text with these exact headings, in this order, each on its own line starting with "## ":

## The idea
Two sentences: the partnership and why now. Concrete enough to picture, not "a partnership".

## Fit scorecard
Four lines, each starting with "- " and a label:
- Audience affinity: the slate rank (for example "#2 of 10 brands the seed's fans over-index on") and the affinity number.
- Ranked both ways: the reverse rank in plain words, or that the seed is not in the partner's top 50, and what that means.
- Shared taste: the tags both carry, or the closest shared theme if none match exactly.
- Risk: one honest risk (category clash, audience mismatch, cultural or geographic sensitivity, a moment versus a durable fit).

## The evidence
Two to four lines starting with "- ", each a number or tag from Qloo and what it shows.

## ${p.launchHeading}
Lines starting with "- ": ${p.launchGuidance} Start the market line with "- Market: " and each venue line with "- Venue: ".

## The ask
One or two sentences: what ${p.outreachFrom} should propose to ${p.outreachTo} first.

Style: written for a partnerships lead, not an engineer. Short sentences. No bold, no emoji, no other headings, no preamble before "## The idea", nothing after the ask. Refer to brands, shows, films, podcasts and places as "it" or "its fans" or by name, never "he" or "she"; refer to people and artists by name.`;
};

function userTurn({ seed, pick, domain, slateRank, slateSize, fromSlate = true, anchor, basedOn, region, constraints }: BriefInput) {
  return [
    ...(constraints ? [`The user's constraints: ${constraints}. The venue tool returns up to eight with their tags; skip any venue that breaks a constraint (for example a cocktail bar under "no alcohol") and name three that don't.`] : []),
    ...(region ? [`Launch region: the user asked to launch in ${region.label}. The market tools only return markets there; choose the launch market from them.`] : []),
    anchor
      ? `Seed: ${seed.name} (brand, not in Qloo yet). ${seed.short_description ?? ""}\nThe slate was built from fans of: ${basedOn?.join(", ")}. Stand-in for the reverse check: ${anchor.name}.`
      : `Seed: ${seed.name} (${seed.type.split(":").pop()}). ${seed.short_description ?? ""}`,
    `Partner: ${pick.name} (${domain}). ${pick.short_description ?? ""}`,
    `Partner tags: ${pick.tags.join(", ") || "none"}`,
    fromSlate
      ? `Forward fit: #${slateRank} of ${slateSize} ${domain} picks in the seed's slate, affinity ${pick.affinity.toFixed(2)}, partner popularity ${pick.popularity.toFixed(2)}.`
      : `Forward fit: the user picked this partner directly. ${slateRank ? `It is #${slateRank} among the seed's fans' top ${slateSize} ${domain}s` : `It is outside the seed's fans' top ${slateSize} ${domain}s`}, affinity ${pick.affinity.toFixed(2)}, partner popularity ${pick.popularity.toFixed(2)}. Cite that instead of a slate rank.`,
  ].join("\n");
}

// --- tools ---

// Reverse direction (PLAN.md section 3, pairing row): raw pairwise affinity is inflated by popularity, so report
// where the seed lands in the partner's own top 50 for the seed's category, not just the raw number. 2 Qloo calls.
async function reverseAffinity(seed: Card, pick: Pick) {
  const d = await rankAmongFans(seed, pick.entity_id); // shared with the slate badges and pairing mode
  return {
    seed_rank_in_partner_top50: d.rank,
    seed_affinity_among_partner_fans: d.affinity,
    partner_top10_cutoff_affinity: d.top10Cutoff,
    partner_top50_cutoff_affinity: d.top50Cutoff,
    partner_top5_in_seed_category: d.top5,
    seed_tags: d.tags,
    partner_tags: pick.tags,
  };
}

// Markets in both top tens. The seed's heatmap is cached from the run; the partner's is 1 Qloo call, cached.
async function heatmapOverlap(input: BriefInput) {
  const [seed, partner] = await Promise.all([
    getCities(input.seedSignal, input.region?.states),
    forced("noheatmap") ? Promise.resolve({ metros: [], cellCount: 0 }) : getCities(input.pick.entity_id, input.region?.states).catch(() => ({ metros: [], cellCount: 0 })),
  ]);
  if (!partner.cellCount)
    return { overlap: [], seed_top_markets: seed.metros.slice(0, 3).map((m) => ({ market: m.name, over_index: m.overIndex })), note: `Qloo has no US heatmap for ${input.pick.name}, so there is no overlap to measure.` };
  return {
    overlap: overlapMarkets(seed.metros, partner.metros),
    seed_top_markets: seed.metros.slice(0, 3).map((m) => ({ market: m.name, over_index: m.overIndex })),
    partner_top_markets: partner.metros.slice(0, 3).map((m) => ({ market: m.name, over_index: m.overIndex })),
  };
}

const PLACE_TAGS = ["urn:tag:category:place:restaurant", "urn:tag:category:place:bar"]; // restaurants and bars, every seed type

// Venues both audiences over-index on in a market: restaurants plus bars (1 Qloo call each), union, top 5.
// If the market has none, falls back to the seed's next top market and says so.
async function placesInCity(input: BriefInput, market: string) {
  const seedTop = (await getCities(input.seedSignal, input.region?.states)).metros.map((m) => m.name);
  // artists add live-music venues (tag looked up once via /v2/tags, cached); every type gets restaurants and bars
  const extra = playbookFor(input.seed.type).venueQuery;
  const extraTag = extra ? await placeTag(extra).catch(() => null) : null;
  // no-alcohol refines (Oct 24): swap the bar tag for cafes and coffee shops, looked up once via /v2/tags (cached)
  const dry = input.noBars ? (await Promise.all(["cafe", "coffee shop"].map((q) => placeTag(q).catch(() => null)))).filter((t) => t !== null).map((t) => t.tag_id) : [];
  const base = input.noBars ? [PLACE_TAGS[0], ...new Set(dry)] : PLACE_TAGS;
  const placeTags = extraTag ? [extraTag.tag_id, ...base] : base;
  const tried: string[] = [];
  for (const m of [market, ...seedTop.filter((x) => x !== market)].slice(0, 2)) {
    tried.push(m);
    const lists = await Promise.all(
      placeTags.map((tag) => {
        if (forced("novenues") && m === market) return Promise.resolve([]);
        const params = { "filter.type": "urn:entity:place", "filter.location.query": m, "filter.tags": tag, take: 8 };
        return (
          typeof input.seedSignal === "string"
            ? insights({ ...params, "signal.interests.entities": `${input.seedSignal},${input.pick.entity_id}` })
            : insightsPost("urn:entity:place", [...input.seedSignal, { id: input.pick.entity_id, weight: 10 }], params)
        ).catch(() => []); // a tag Qloo rejects just contributes nothing
      }),
    );
    const venues = lists
      .flat()
      .filter((v, i, all) => all.findIndex((x) => x.entity_id === v.entity_id) === i)
      .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))
      .slice(0, 8) // eight with their tags, so the brief can skip venues that break a constraint (brief-v4.2)
      .map((v) => ({ name: v.name, address: v.address ?? null, city: v.city ?? null, price_level: v.price_level ?? null, affinity: v.affinity ?? null, tags: [...new Set(v.tags.map((t) => t.name))].slice(0, 6) }));
    if (venues.length) return { market: m, venues, ...(m !== market ? { note: `No venues came back for ${market}, so these are in ${m}, the seed's next market.` } : {}) };
  }
  return { market, venues: [], note: `Qloo returned no restaurant or bar venues in ${tried.join(" or ")}.` };
}

// Venue details (price level, affinity) for the panel, from the same lookup the brief's tool made. The trace names
// the market the tool settled on, so for any brief that found venues this is a cache hit: 0 Qloo calls.
export async function venuesFor(input: BriefInput, trace: string[]) {
  const market = trace.map((t) => /^Found \d+ venues in (.+)$/.exec(t)?.[1] ?? /so these are in (.+), the seed's next market\.$/.exec(t)?.[1]).find(Boolean);
  if (!market) return null;
  const r = await placesInCity(input, market);
  return r.market === market ? r : null; // a different market would mean fresh calls happened; never show those
}

// --- generation ---

async function generate(input: BriefInput, say: (t: string) => void, write: (d: string) => void): Promise<BriefResult> {
  const trace: string[] = [];
  const log = (t: string) => (trace.push(t), say(t));
  const who = (input.anchor ?? input.seed).name;
  let text = "";

  const result = streamText({
    model: anthropic(MODEL),
    maxOutputTokens: 16000,
    providerOptions: { anthropic: { effort: "medium", fallbacks: "default" } },
    stopWhen: isStepCount(7),
    tools: {
      qloo_reverse_affinity: tool({
        description:
          "Check the pairing from the partner's side: where the seed lands among the partner's fans' top 50 in the seed's category, the seed's raw affinity with those fans, cutoffs for context, and both entities' Qloo tags.",
        inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {}, additionalProperties: false }),
        execute: async () => reverseAffinity(input.anchor ?? input.seed, input.pick),
      }),
      qloo_heatmap_overlap: tool({
        description: "US markets in both the seed's and the partner's top ten, with each side's over-index (100 = US average), highest combined first. Also each side's top three markets.",
        inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {}, additionalProperties: false }),
        execute: async () => heatmapOverlap(input),
      }),
      qloo_places_in_city: tool({
        description: "Venues (restaurants and bars, plus music venues for artists) that both the seed's and the partner's fans over-index on, in one US market. Returns up to 8 with address, price level, affinity, and tags.",
        inputSchema: jsonSchema<{ market: string }>({
          type: "object",
          properties: { market: { type: "string", description: "A market name exactly as qloo_heatmap_overlap returned it" } },
          required: ["market"],
          additionalProperties: false,
        }),
        execute: async ({ market }) => placesInCity(input, market.slice(0, 60)),
      }),
      qloo_tags: tool({
        description: "Search Qloo's tag vocabulary for a theme (for example 'sustainability' or 'skate culture'). Returns up to 10 matching tags.",
        inputSchema: jsonSchema<{ query: string }>({
          type: "object",
          properties: { query: { type: "string", description: "A short theme to look up" } },
          required: ["query"],
          additionalProperties: false,
        }),
        execute: async ({ query }) => (await tags(query.slice(0, 60))).slice(0, 10).map((t) => t.name),
      }),
    },
    instructions: { role: "system", content: system(input.seed.type), providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages: [{ role: "user", content: userTurn(input) }],
  });

  for await (const part of result.stream) {
    if (part.type === "tool-call") {
      const q = part.input as { query?: string; market?: string };
      log(
        {
          qloo_reverse_affinity: `Checking where ${who} ranks among ${input.pick.name} fans' picks`,
          qloo_heatmap_overlap: `Finding the markets where both audiences run hot`,
          qloo_places_in_city: `Looking for venues in ${q.market} that both audiences love`,
          qloo_tags: `Looking up Qloo tags for "${q.query}"`,
        }[part.toolName] ?? `Calling ${part.toolName}`,
      );
    } else if (part.type === "tool-result") {
      const out = part.output as Record<string, unknown>;
      if (part.toolName === "qloo_reverse_affinity")
        log(out.seed_rank_in_partner_top50 ? `${who} is #${out.seed_rank_in_partner_top50} among ${input.pick.name} fans` : `${who} isn't in ${input.pick.name} fans' top 50`);
      if (part.toolName === "qloo_heatmap_overlap") {
        const o = out.overlap as { market: string }[];
        log(out.note ? String(out.note) : o.length ? `Both run hot in ${o.slice(0, 3).map((m) => m.market).join(", ")}` : "No market is in both top tens");
      }
      if (part.toolName === "qloo_places_in_city") log(out.note ? String(out.note) : `Found ${(out.venues as unknown[]).length} venues in ${out.market}`);
    } else if (part.type === "text-delta") {
      text += part.text;
      write(part.text);
      if (forced("anthropic") && text.length > 300) throw new Error("forced mid-stream failure");
    } else if (part.type === "tool-error") {
      // A failed Qloo tool would leave the model writing without evidence. Stop instead; the user can retry,
      // and anything already streamed stays on screen.
      throw part.error;
    } else if (part.type === "error") {
      throw part.error;
    } else if (part.type === "finish" && part.finishReason === "content-filter") {
      throw new Error("refused");
    }
  }
  if (!text.trim()) throw new Error("empty brief");
  return { text, trace, usage: await result.totalUsage };
}

const keyOf = (i: BriefInput) => `${i.seed.entity_id}:${i.seed.name}:${i.basedOn?.join("|") ?? ""}:${i.pick.entity_id}`;

// Cached 30 days per (seed, pick). Bump the version to regenerate every brief after a prompt change.
// brief-v4.3 / v4.4 (Oct 11): rank facts instead of "like the seed back", and "Ranked both ways" replaces "Mutual fit".
// Refined briefs (with constraints) were brief-v4.2: the venue-skipping line (Oct 23). Unrefined briefs kept brief-v4.1, so
// the warm demo briefs stay cached; their prompt is unchanged apart from the venue tool returning eight.
export const brief = streamCache("brief", (i: BriefInput) => (i.constraints ? "brief-v4.4" : "brief-v4.3"), keyOf, generate);
export { CapReached } from "./stream-cache.ts";
