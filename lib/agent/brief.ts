// Brief agent: a tool-using Claude Opus 5.5 loop that checks a pairing both ways in Qloo, then writes a
// partnership one-pager (PLAN.md section 2, step 6). Wednesday adds venues and map overlap.
import { streamText, jsonSchema, tool, isStepCount, type LanguageModelUsage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { cached, insights, tags } from "../qloo.ts";
import type { Card, Domain, Pick } from "../slate.ts";
import { MODEL } from "./rank.ts";

export type BriefInput = { seed: Card; pick: Pick; domain: Domain; slateRank: number; slateSize: number };
export type BriefResult = { text: string; trace: string[]; usage: LanguageModelUsage | null };
type Listener = { ip: string; ran: boolean; trace: (t: string) => void; text: (d: string) => void };

const SYSTEM = `You are the partnerships strategist inside Crossover. A partnerships lead picked a potential collab partner from a slate Qloo built for their brand (the seed). Your job: check the fit both ways with Qloo, then write a one-page partnership brief they could forward to their boss.

Playbook:
1. Call qloo_reverse_affinity first. Forward fit (how much the seed's fans over-index on the partner) is already given to you as a slate rank. The reverse call tells you whether the partner's fans like the seed back: where the seed lands among the partner's own top 50 in the seed's category, plus both entities' tags. A pairing that works one way only is a weaker pitch; say so.
2. Optionally call qloo_tags once if a shared theme needs grounding in Qloo's tag vocabulary.
3. Write the brief. Use only facts from the input and the tool results. Never invent numbers, sales figures, past collabs, or quotes.

Write the brief in plain text with these exact headings, in this order, each on its own line starting with "## ":

## The idea
Two sentences: the collab and why now. Concrete enough to picture (a product, a drop, an event, content), not "a partnership".

## Fit scorecard
Four lines, each starting with "- " and a label:
- Audience affinity: the slate rank (for example "#2 of 10 brands the seed's fans over-index on") and the affinity number.
- Mutual fit: the reverse rank in plain words, or that the seed is not in the partner's top 50, and what that means.
- Shared taste: the tags both carry, or the closest shared theme if none match exactly.
- Risk: one honest risk (category clash, audience mismatch, cultural or geographic sensitivity, a moment versus a durable fit).

## The evidence
Two to four lines starting with "- ", each a number or tag from Qloo and what it shows.

## The ask
One or two sentences: what the seed's team should propose to the partner's team first.

Launch plan: Wednesday

Style: written for a partnerships lead, not an engineer. Short sentences. No bold, no emoji, no other headings, no preamble before "## The idea", nothing after "Launch plan: Wednesday".`;

function userTurn({ seed, pick, domain, slateRank, slateSize }: BriefInput) {
  return [
    `Seed: ${seed.name} (${seed.type.split(":").pop()}). ${seed.short_description ?? ""}`,
    `Partner: ${pick.name} (${domain}). ${pick.short_description ?? ""}`,
    `Partner tags: ${pick.tags.join(", ") || "none"}`,
    `Forward fit: #${slateRank} of ${slateSize} ${domain} picks in the seed's slate, affinity ${pick.affinity.toFixed(2)}, partner popularity ${pick.popularity.toFixed(2)}.`,
  ].join("\n");
}

// Reverse direction (PLAN.md section 3, pairing row): raw pairwise affinity is inflated by popularity, so report
// where the seed lands in the partner's own top 50 for the seed's category, not just the raw number. 2 Qloo calls.
async function reverseAffinity(seed: Card, pick: Pick) {
  const [direct, top50] = await Promise.all([
    insights({ "filter.type": seed.type, "signal.interests.entities": pick.entity_id, "filter.results.entities": seed.entity_id, take: 1 }),
    insights({ "filter.type": seed.type, "signal.interests.entities": pick.entity_id, take: 50 }),
  ]);
  const at = top50.findIndex((e) => e.entity_id === seed.entity_id);
  return {
    seed_rank_in_partner_top50: at >= 0 ? at + 1 : null,
    seed_affinity_among_partner_fans: direct[0]?.affinity ?? null,
    partner_top10_cutoff_affinity: top50[9]?.affinity ?? null,
    partner_top50_cutoff_affinity: top50.at(-1)?.affinity ?? null,
    partner_top5_in_seed_category: top50.slice(0, 5).map((e) => e.name),
    seed_tags: direct[0]?.tags.map((t) => t.name) ?? [],
    partner_tags: pick.tags,
  };
}

// --- caching a streamed generation ---
// unstable_cache can't hold a stream, so the cached function does the generation itself and forwards tokens to
// whichever request is waiting on that pair (looked up by key). A cache hit skips the function and the route
// replays the stored result. ponytail: one listener per pair, so two simultaneous first-time requests for the
// same pair stream to the later one only; the earlier gets the full text when it finishes. Fine for a demo.
const listeners = new Map<string, Listener>();
const keyOf = (i: BriefInput) => `${i.seed.entity_id}:${i.pick.entity_id}`;

// ponytail: per-instance, in-memory, resets on cold start, so the real ceiling is 20 x live instances per IP.
// Upgrade path: a KV counter (Upstash or Vercel KV) keyed by ip:date.
const DAILY_CAP = 20;
const usageByIp = new Map<string, { day: string; n: number }>();
export class CapReached extends Error {}
function spend(ip: string) {
  const day = new Date().toISOString().slice(0, 10);
  const u = usageByIp.get(ip);
  const n = u?.day === day ? u.n : 0;
  if (n >= DAILY_CAP) throw new CapReached();
  usageByIp.set(ip, { day, n: n + 1 });
}

async function generate(input: BriefInput): Promise<BriefResult> {
  const l = listeners.get(keyOf(input));
  if (l) l.ran = true;
  spend(l?.ip ?? "unknown"); // only fresh generations count toward the cap; cached briefs are free
  const trace: string[] = [];
  const say = (t: string) => (trace.push(t), l?.trace(t));
  let text = "";

  const result = streamText({
    model: anthropic(MODEL),
    maxOutputTokens: 16000,
    providerOptions: { anthropic: { effort: "medium", fallbacks: "default" } },
    stopWhen: isStepCount(5),
    tools: {
      qloo_reverse_affinity: tool({
        description:
          "Check the pairing from the partner's side: where the seed lands among the partner's fans' top 50 in the seed's category, the seed's raw affinity with those fans, cutoffs for context, and both entities' Qloo tags.",
        inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {}, additionalProperties: false }),
        execute: async () => reverseAffinity(input.seed, input.pick),
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
    instructions: { role: "system", content: SYSTEM, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages: [
      { role: "user", content: userTurn(input) },
    ],
  });

  for await (const part of result.stream) {
    if (part.type === "tool-call") {
      say(part.toolName === "qloo_reverse_affinity" ? `Checking whether ${input.pick.name} fans like ${input.seed.name} back` : `Looking up Qloo tags for "${(part.input as { query?: string }).query}"`);
    } else if (part.type === "tool-result" && part.toolName === "qloo_reverse_affinity") {
      const r = part.output as Awaited<ReturnType<typeof reverseAffinity>>;
      say(r.seed_rank_in_partner_top50 ? `${input.seed.name} is #${r.seed_rank_in_partner_top50} among ${input.pick.name} fans` : `${input.seed.name} isn't in ${input.pick.name} fans' top 50`);
    } else if (part.type === "text-delta") {
      text += part.text;
      l?.text(part.text);
    } else if (part.type === "error") {
      throw part.error;
    }
  }
  if (!text.trim()) throw new Error("empty brief");
  return { text, trace, usage: await result.totalUsage };
}

const PROMPT_VERSION = "brief-v1"; // bump to regenerate every cached brief after a prompt change
const briefCached = cached("brief", (_v: string, input: BriefInput) => generate(input));

// Runs or replays a brief. Live tokens go to onTrace/onText; on a cache hit the caller gets the stored result
// with ran=false and replays it.
export async function brief(input: BriefInput, ip: string, onTrace: (t: string) => void, onText: (d: string) => void) {
  const l: Listener = { ip, ran: false, trace: onTrace, text: onText };
  listeners.set(keyOf(input), l);
  try {
    const result = await briefCached(PROMPT_VERSION, input);
    return { ...result, ran: l.ran };
  } finally {
    if (listeners.get(keyOf(input)) === l) listeners.delete(keyOf(input));
  }
}
