// Refine turn (PLAN.md section 2 step 8): one sentence of constraints ("no alcohol partners, Texas only") becomes a
// constraint set that re-plans retrieval. Opus reads the sentence; code resolves every piece against Qloo (tags via
// /v2/tags, names via search) and anything that doesn't map becomes a visible "could not apply" note, never a
// silent no-op.
import { generateText, jsonSchema, Output, type LanguageModelUsage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { cached, search, tagSearch, RESOLVE_TYPES, type Tag } from "./qloo.ts";
import { resolve } from "./resolve.ts";
import { DOMAINS, type Domain } from "./slate.ts";
import { MODEL } from "./agent/rank.ts";

export type TagRef = Tag & { domains: Domain[] };
export type Applied = { kind: "include" | "exclude" | "region" | "domains" | "popularity" | "exclude_name"; phrase: string; label: string };
export type ConstraintSet = {
  sentence: string;
  applied: Applied[]; // one chip each; removing one re-runs without its phrase
  includeTags: TagRef[];
  excludeTags: TagRef[];
  states: string[] | null; // markets kept (two-letter codes)
  locationQuery: string | null; // signal.location.query on the domain calls
  domains: Domain[] | null; // domain whitelist
  popularityMin: number | null;
  excludeIds: string[];
  notes: string[]; // what couldn't be applied, in plain words
  summary: string; // the trace line
};

// --- interpretation (Opus, structured output) ---

type Raw = {
  include: { phrase: string; tag_query: string; applies_to: Domain[] }[];
  exclude: { phrase: string; tag_query: string; applies_to: Domain[] }[];
  region: { phrase: string; label: string; states: string[]; location_query: string } | null;
  domains: { phrase: string; domains: Domain[] } | null;
  popularity_min: { phrase: string; value: number } | null;
  exclude_names: { phrase: string; name: string }[];
  unmapped: { phrase: string; why: string }[];
};

const tagItem = {
  type: "object" as const,
  additionalProperties: false,
  required: ["phrase", "tag_query", "applies_to"],
  properties: {
    phrase: { type: "string" as const, description: "The user's words for this constraint, verbatim" },
    tag_query: { type: "string" as const, description: "A short phrase to search Qloo's tag vocabulary with, e.g. 'beer', 'live music', 'vegan'" },
    applies_to: { type: "array" as const, items: { type: "string" as const, enum: [...DOMAINS] } },
  },
};

const schema = jsonSchema<Raw>({
  type: "object",
  additionalProperties: false,
  required: ["include", "exclude", "region", "domains", "popularity_min", "exclude_names", "unmapped"],
  properties: {
    include: { type: "array", items: tagItem, description: "Kinds of partner to require (each becomes a Qloo tag filter)" },
    exclude: { type: "array", items: tagItem, description: "Kinds of partner to rule out (each becomes a Qloo tag exclusion)" },
    region: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["phrase", "label", "states", "location_query"],
          properties: {
            phrase: { type: "string" },
            label: { type: "string", description: "Short display name, e.g. 'Texas' or 'the Southeast'" },
            states: { type: "array", items: { type: "string" }, description: "US state two-letter codes in the region (DC counts as DC)" },
            location_query: { type: "string", description: "One place a location search would understand, best representing the region: a state name or a major city" },
          },
        },
      ],
    },
    domains: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["phrase", "domains"],
          properties: { phrase: { type: "string" }, domains: { type: "array", items: { type: "string", enum: [...DOMAINS] } } },
        },
      ],
    },
    popularity_min: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["phrase", "value"],
          properties: { phrase: { type: "string" }, value: { type: "number", description: "0 to 1; 0.5 for 'well-known', 0.8 for 'household names'" } },
        },
      ],
    },
    exclude_names: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phrase", "name"],
        properties: { phrase: { type: "string" }, name: { type: "string", description: "One specific entity to exclude, by name" } },
      },
    },
    unmapped: {
      type: "array",
      description: "Anything the user asked for that none of the fields above can express",
      items: { type: "object", additionalProperties: false, required: ["phrase", "why"], properties: { phrase: { type: "string" }, why: { type: "string" } } },
    },
  },
});

const SYSTEM = `You turn a partnerships lead's one-line constraints into filters for a taste-data tool (Qloo). The tool finds partners across six domains: brand, artist, tv_show, movie, place, podcast.

Express each constraint with exactly one field:
- include / exclude: a kind of partner, as a short tag search phrase ("beer", "wine", "cannabis", "live music", "outdoor gear"). "No alcohol" means excluding each relevant kind (beer, wine, spirits) as separate entries. Pick applies_to domains where the kind makes sense (alcohol applies to brand and place).
- region: a US region ("Texas", "the Southeast", "West Coast") with its states and one representative place for location search.
- domains: when they limit which kinds of partner to show ("brands and artists only").
- popularity_min: when they ask for well-known or big names.
- exclude_names: specific entities to leave out.
- unmapped: anything these can't express, such as founder attributes, ownership, revenue, values claims, dates, or budgets. Say briefly why.

Keep each phrase as the user wrote it. Do not invent constraints the user didn't state. "Brands that sponsor live music" is an include on brands, with tag_query "live music" or "music sponsorship", not a domains restriction alone.`;

async function interpretRaw(seedName: string, seedKind: string, sentence: string): Promise<{ raw: Raw; usage: LanguageModelUsage | null }> {
  const { output, usage } = await generateText({
    model: anthropic(MODEL),
    maxOutputTokens: 6000,
    providerOptions: { anthropic: { effort: "medium", fallbacks: "default" } },
    output: Output.object({ schema }),
    instructions: { role: "system", content: SYSTEM, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages: [{ role: "user", content: `Seed: ${seedName} (${seedKind}).\nConstraints: ${sentence}` }],
  });
  return { raw: output, usage };
}

// --- resolution against Qloo ---

// The first tag whose parents include one of the domains' entity types. 1 call per (phrase, domains), cached.
export function pickTag(tags: { id: string; name: string; type: string; parents?: { type: string }[] }[], domains: Domain[]): Tag | null {
  const wanted = domains.map((d) => `urn:entity:${d}`);
  const t = tags.find((x) => (x.parents ?? []).some((p) => wanted.includes(p.type)));
  return t ? { tag_id: t.id, name: t.name, type: t.type } : null;
}
const tagFor = async (query: string, domains: Domain[]): Promise<Tag | null> =>
  pickTag(await tagSearch(query, domains.map((d) => `urn:entity:${d}`).join(",")), domains);

const plural: Record<Domain, string> = { brand: "brands", artist: "artists", tv_show: "TV shows", movie: "films", place: "places", podcast: "podcasts" };
const listJoin = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

// Pure: raw interpretation plus lookup results in, constraint set out. Every piece either applies (with a chip)
// or becomes a note.
export function buildConstraintSet(
  sentence: string,
  raw: Raw,
  tags: Map<string, Tag | null>, // key: `${tag_query}|${applies_to}`
  names: Map<string, { id: string; name: string } | null>, // key: name
): ConstraintSet {
  const applied: Applied[] = [];
  const notes: string[] = [];
  const resolveTags = (items: Raw["include"], kind: "include" | "exclude") =>
    items.flatMap((it) => {
      const domains = it.applies_to.filter((d) => DOMAINS.includes(d));
      const t = tags.get(`${it.tag_query}|${domains.join(",")}`) ?? null;
      if (!t || !domains.length) {
        notes.push(`"${it.phrase}": Qloo has no matching tag for ${it.tag_query}`);
        return [];
      }
      applied.push({ kind, phrase: it.phrase, label: `${kind === "include" ? "Only" : "No"} ${t.name}` });
      return [{ ...t, domains }];
    });
  const includeTags = resolveTags(raw.include, "include");
  const excludeTags = resolveTags(raw.exclude, "exclude");

  const states = raw.region?.states.map((s) => s.toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)) ?? [];
  if (raw.region && states.length) applied.push({ kind: "region", phrase: raw.region.phrase, label: raw.region.label });
  else if (raw.region) notes.push(`"${raw.region.phrase}": couldn't tell which US states that covers`);

  const domains = raw.domains?.domains.filter((d) => DOMAINS.includes(d)) ?? [];
  if (raw.domains && domains.length) applied.push({ kind: "domains", phrase: raw.domains.phrase, label: `${listJoin(domains.map((d) => plural[d]))} only` });

  const popularityMin = raw.popularity_min ? Math.min(0.95, Math.max(0, raw.popularity_min.value)) : null;
  if (raw.popularity_min) applied.push({ kind: "popularity", phrase: raw.popularity_min.phrase, label: "Well-known names" });

  const excludeIds: string[] = [];
  for (const n of raw.exclude_names) {
    const hit = names.get(n.name) ?? null;
    if (hit) {
      excludeIds.push(hit.id);
      applied.push({ kind: "exclude_name", phrase: n.phrase, label: `No ${hit.name}` });
    } else notes.push(`"${n.phrase}": couldn't find ${n.name} in Qloo`);
  }
  for (const u of raw.unmapped) notes.push(`"${u.phrase}": ${u.why}`);

  const parts = [
    ...excludeTags.map((t) => `excluding ${t.name}`),
    ...includeTags.map((t) => `only ${t.name}`),
    ...(states.length ? [`restricting to ${raw.region!.label}`] : []),
    ...(domains.length ? [`${listJoin(domains.map((d) => plural[d]))} only`] : []),
    ...(popularityMin ? ["well-known names only"] : []),
    ...excludeIds.map((_, i) => applied.filter((a) => a.kind === "exclude_name")[i].label.toLowerCase()),
  ];
  return {
    sentence,
    applied,
    includeTags,
    excludeTags,
    states: states.length ? states : null,
    locationQuery: states.length ? raw.region!.location_query : null,
    domains: domains.length ? domains : null,
    popularityMin,
    excludeIds,
    notes,
    summary: parts.length ? `Reading your constraints: ${parts.join("; ")}.` : "Reading your constraints: nothing here maps to a filter.",
  };
}

async function interpretUncached(seedName: string, seedKind: string, sentence: string) {
  const { raw, usage } = await interpretRaw(seedName, seedKind, sentence);
  const tagQueries = [...raw.include, ...raw.exclude].map((it) => ({ key: `${it.tag_query}|${it.applies_to.join(",")}`, it }));
  const [tagResults, nameResults] = await Promise.all([
    Promise.all(tagQueries.map(async ({ key, it }) => [key, it.applies_to.length ? await tagFor(it.tag_query.slice(0, 60), it.applies_to) : null] as const)),
    Promise.all(
      raw.exclude_names.map(async (n) => {
        const r = await resolve(n.name, await search(n.name.slice(0, 80), RESOLVE_TYPES, 5));
        return [n.name, r.status === "confident" ? { id: r.match.entity_id, name: r.match.name } : null] as const;
      }),
    ),
  ]);
  console.log("[refine] interpret usage", JSON.stringify(usage));
  return buildConstraintSet(sentence, raw, new Map(tagResults), new Map(nameResults));
}

// Cached 30 days per (seed, sentence).
export const interpret = (seedName: string, seedKind: string, sentence: string) => interpretCached("refine-v1", seedName, seedKind, sentence.trim().slice(0, 200));
const interpretCached = cached("refine", (_v: string, seedName: string, seedKind: string, sentence: string) => interpretUncached(seedName, seedKind, sentence));

// Per-domain insights params for a constraint set (merged into the slate call for that domain).
export function refineParams(c: ConstraintSet | null | undefined, d: Domain): Record<string, string | number> | null {
  if (!c) return {};
  if (c.domains && !c.domains.includes(d)) return null; // domain not wanted: skip the call
  const inc = c.includeTags.filter((t) => t.domains.includes(d)).map((t) => t.tag_id);
  const exc = c.excludeTags.filter((t) => t.domains.includes(d)).map((t) => t.tag_id);
  return {
    ...(inc.length ? { "filter.tags": inc.join(",") } : {}),
    ...(exc.length ? { "filter.exclude.tags": exc.join(",") } : {}),
    ...(c.locationQuery ? { "signal.location.query": c.locationQuery } : {}),
    ...(c.popularityMin ? { "filter.popularity.min": c.popularityMin } : {}),
  };
}
