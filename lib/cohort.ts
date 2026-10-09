// "Who does this land with?" (PLAN.md section 2 step 6, Oct 22): the partner's affinity among the seed's fans, one
// age bracket at a time. 6 Qloo calls on first use, then one Haiku sentence naming the strongest bracket. The whole
// result is cached under cohort-v1; peekCohort reads it without ever calling Qloo or Claude.
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { cached, insights, insightsPost, type Signal } from "./qloo.ts";

import { AGES, AGE_LABEL, type Age } from "./ages.ts";

export { AGES, AGE_LABEL, type Age };
export type Cohort = { buckets: { age: Age; affinity: number | null }[]; strongest: Age | null; sentence: string };

// Pure: the bracket with the highest affinity, or null when Qloo returned nothing for any of them.
export function strongestOf(buckets: Cohort["buckets"]): Age | null {
  let best: Cohort["buckets"][number] | null = null;
  for (const b of buckets) if (b.affinity !== null && (best === null || b.affinity > (best.affinity ?? -1))) best = b;
  return best?.age ?? null;
}

type CohortInput = { seedName: string; seedSignal: string | Signal[]; partner: { entity_id: string; name: string; type: string } };

async function bucket(i: CohortInput, age: Age) {
  const params = { "signal.demographics.age": age, "filter.results.entities": i.partner.entity_id, take: 1 };
  const [hit] =
    typeof i.seedSignal === "string"
      ? await insights({ "filter.type": i.partner.type, "signal.interests.entities": i.seedSignal, ...params })
      : await insightsPost(i.partner.type, i.seedSignal, params);
  return { age, affinity: hit?.affinity ?? null };
}

async function compute(i: CohortInput): Promise<Cohort> {
  const buckets = [];
  for (const age of AGES) buckets.push(await bucket(i, age)); // serial: the client's token bucket paces them anyway
  const strongest = strongestOf(buckets);
  if (!strongest) return { buckets, strongest, sentence: `Qloo has no age breakdown for ${i.partner.name} among ${i.seedName}'s fans.` };
  const { text, usage } = await generateText({
    model: anthropic("claude-haiku-5-5"),
    maxOutputTokens: 1000,
    providerOptions: { anthropic: { effort: "low" } },
    prompt: `${i.partner.name}'s affinity among ${i.seedName}'s fans, by age bracket (0 to 1, higher means that bracket over-indexes more on ${i.partner.name}):
${buckets.map((b) => `${AGE_LABEL[b.age]}: ${b.affinity?.toFixed(3) ?? "no data"}`).join("\n")}

Write one plain sentence, under 25 words, for a partnerships lead: name the bracket where this pairing lands hardest (${AGE_LABEL[strongest]}) and how the others compare. Use only these numbers. No preamble.`,
  });
  console.log(`[cohort] ${i.seedName} x ${i.partner.name} usage`, JSON.stringify(usage));
  return { buckets, strongest, sentence: text.trim() };
}

const cohortCached = cached("cohort", (_v: string, i: CohortInput) => compute(i));
export const getCohort = (i: CohortInput) => cohortCached("cohort-v1", i);
export const peekCohort = (i: CohortInput) => cohortCached.peek("cohort-v1", i);
