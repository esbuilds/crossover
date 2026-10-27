// Outreach email, written only after a human approves the brief. Nothing is sent.
import { streamText, type LanguageModelUsage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { MODEL } from "./rank.ts";
import { playbookFor } from "../playbook.ts";
import { brief, type BriefInput } from "./brief.ts";
import { streamCache, type Streamed } from "./stream-cache.ts";

// Who writes and who receives depends on the seed type (lib/playbook.ts): a brand to a brand, an artist's
// management to a sponsor, a studio's consumer products team to a licensee, a person's management to a brand.
const system = (seedType: string) => {
  const p = playbookFor(seedType);
  return `You write the first outreach email from ${p.outreachFrom} to ${p.outreachTo}, proposing a partnership where the partner is a ${p.partnerRole}. You get the approved brief.

Format, plain text:
Subject: <a specific subject line, under 10 words>

Then exactly four short paragraphs:
1. Who we are and the one-line idea.
2. Why it fits, citing exactly two numbers from the brief (for example a slate rank and an over-index), in plain words.
3. What the first version looks like: the market, a venue or two, the moment.
4. A concrete ask with a next step (a 20-minute call next week, a small test, a specific date range).

Rules: under 170 words after the subject line. Warm, direct, no hype words, no bold, no emoji. Use only facts from the brief. If the brief says the seed isn't in Qloo yet, don't mention Qloo stand-ins to the partner; describe the audience instead. Refer to brands, shows and films as "it" or by name, never "he" or "she". Sign off as "[Your name]".`;
};

export type OutreachResult = Streamed & { usage: LanguageModelUsage | null };

async function generate(input: BriefInput, say: (t: string) => void, write: (d: string) => void): Promise<OutreachResult> {
  // The approved brief is cached; this is a lookup, not a second generation.
  const b = await brief(input, "outreach", () => {}, () => {});
  say("Drafting the email from the approved brief");
  const result = streamText({
    model: anthropic(MODEL),
    maxOutputTokens: 4000,
    providerOptions: { anthropic: { effort: "medium", fallbacks: "default" } },
    instructions: { role: "system", content: system(input.seed.type), providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages: [{ role: "user", content: `From: ${playbookFor(input.seed.type).outreachFrom} for ${input.seed.name}\nTo: ${input.pick.name}'s partnerships team\n\nApproved brief:\n${b.text}` }],
  });
  let text = "";
  for await (const part of result.stream) {
    if (part.type === "text-delta") {
      text += part.text;
      write(part.text);
    } else if (part.type === "error") throw part.error;
    else if (part.type === "finish" && part.finishReason === "content-filter") throw new Error("refused");
  }
  if (!text.trim()) throw new Error("empty email");
  return { text, trace: ["Drafting the email from the approved brief"], usage: await result.totalUsage };
}

const keyOf = (i: BriefInput) => `${i.seed.entity_id}:${i.seed.name}:${i.basedOn?.join("|") ?? ""}:${i.pick.entity_id}`;
export const outreach = streamCache("outreach", "outreach-v2.1", keyOf, generate);
