// Inbound triage, the model's part (triage-v1): one Opus 5.5 call for the whole table, after the fits land. The buckets
// are decided in code (lib/triage.ts); the model writes one reason per row and a two-sentence summary, and may not move
// a row. Cached per seed plus the sorted names, through streamCache so a fresh triage counts as one generation against
// the per-IP limit and a repeat costs nothing.
import { generateText, jsonSchema, Output, type LanguageModelUsage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { MODEL } from "./rank.ts";
import { streamCache, type Streamed } from "./stream-cache.ts";
import { BUCKET_LABEL, type Bucket } from "../triage.ts";
import type { Card } from "../slate.ts";

export type TriageFact = {
  id: string;
  name: string;
  type: string;
  bucket: Bucket;
  contrast: boolean;
  nameAmongSeed: number | null; // the inbound name among the seed's fans
  seedAmongName: number | null; // the seed among the name's fans
  topMarket: { market: string; seed: number; name: number } | null;
  sharedTags: string[];
};
export type TriageInput = { seed: Card; rows: TriageFact[] };
export type TriageTable = { summary: string; reasons: Record<string, string> };

const SYSTEM = `You explain an inbound triage table for a partnerships lead. Names have pitched a collaboration to the seed. Each row's bucket is already decided from Qloo taste data, and you must not move a row or argue with its bucket:
- Take the call: each audience ranks the other in its top 50, and at least one in its top 10.
- Maybe: only one side's fans rank the other in their top 50.
- Pass: neither does (or both do, weakly, outside every top 10). A contrast play flag means a very well-known partner whose audience still meets the seed's in at least one market, so a one-off stunt could work.

For each row write one reason, under 20 words, in plain language for a partnerships lead: give both ranks (where each sits among the other's fans' picks) and the one fact that matters (a rank, the shared market with its numbers, a shared tag). No jargon, no hype, no numbers you were not given.

Then a summary of exactly two sentences: name the calls to take, and the best maybe if one stands out. If no row is a take, say so plainly.

Always call the seed by its name. Never write the words "seed", "bucket" or "row" in a reason or the summary.`;

type Out = { summary: string; rows: { id: string; reason: string }[] };
const schema = jsonSchema<Out>({
  type: "object",
  additionalProperties: false,
  required: ["summary", "rows"],
  properties: {
    summary: { type: "string" },
    rows: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["id", "reason"], properties: { id: { type: "string" }, reason: { type: "string" } } },
    },
  },
});

const rank = (r: number | null) => (r === null ? "outside the top 50" : `#${r} of 50`);
const line = (r: TriageFact, seed: string) =>
  [
    `${r.id} | ${r.name} (${r.type.replace("urn:entity:", "")}) | ${BUCKET_LABEL[r.bucket]}${r.contrast ? " (contrast play)" : ""}`,
    `among ${seed}'s fans: ${rank(r.nameAmongSeed)}; ${seed} among its fans: ${rank(r.seedAmongName)}`,
    r.topMarket ? `top shared market: ${r.topMarket.market} (${seed} ${r.topMarket.seed}, ${r.name} ${r.topMarket.name})` : "no shared market in both top tens",
    `shared tags: ${r.sharedTags.slice(0, 5).join(", ") || "none"}`,
  ].join(" | ");

async function generate(input: TriageInput): Promise<Streamed & { usage: LanguageModelUsage | null }> {
  const { output, usage } = await generateText({
    model: anthropic(MODEL),
    maxOutputTokens: 8000,
    providerOptions: { anthropic: { effort: "medium", fallbacks: "default" } },
    output: Output.object({ schema }),
    instructions: { role: "system", content: SYSTEM, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages: [{ role: "user", content: `Seed: ${input.seed.name} (${input.seed.type.replace("urn:entity:", "")}). ${input.seed.short_description ?? ""}\n\n${input.rows.map((r) => line(r, input.seed.name)).join("\n")}` }],
  });
  const table: TriageTable = { summary: output.summary.trim(), reasons: Object.fromEntries(output.rows.filter((r) => input.rows.some((x) => x.id === r.id)).map((r) => [r.id, r.reason.trim()])) };
  console.log(`[triage] ${input.seed.name} x ${input.rows.length} names usage`, JSON.stringify(usage));
  return { text: JSON.stringify(table), trace: [], usage };
}

const keyOf = (i: TriageInput) => `${i.seed.entity_id}:${i.rows.map((r) => r.id).sort().join(",")}`;
// triage-v2 (Oct 9 real): the seed by name, none of the words seed, bucket or row. triage-v3: both ranks, not "which way the interest runs".
export const triageTable = streamCache("triage", "triage-v3", keyOf, (i: TriageInput) => generate(i));
