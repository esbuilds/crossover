// Pairing check (PLAN.md section 1, widening 2): two names in, a fit readout out. Everything is assembled from
// cached pieces: both cards, each side's rank among the other's fans (lib/fit.ts), the markets both run hot in,
// shared tags. The verdict class is decided in code (classify); one Opus call writes about it.
import { generateText, type LanguageModelUsage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { cached } from "./qloo.ts";
import { getCard, type Card } from "./slate.ts";
import { getCities, type MapCell } from "./cities.ts";
import { overlapMarkets, type Overlap } from "./overlap.ts";
import { rankAmongFans, classify, type Direction, type PairKind } from "./fit.ts";
import { MODEL } from "./agent/rank.ts";

export type Pair = {
  a: Card;
  b: Card;
  aAmongB: Direction; // where A lands among B's fans
  bAmongA: Direction; // where B lands among A's fans
  overlap: (Overlap & { lat: number; lon: number })[];
  cells: MapCell[]; // A's hottest cells, for the map
  sharedTags: string[];
  kind: PairKind;
  strongSide?: "a" | "b";
  verdict: string;
};

const SYSTEM = `You write the verdict for a pairing check inside Crossover, a partnerships tool built on Qloo taste data. You get two entities (A and B), where each lands among the other's fans (a rank in the fans' top 50 for that category, or outside it, with cutoffs), the US markets where both audiences run hot (over-index, 100 = US average), and the tags both carry. The verdict class is already decided from the ranks; write to it.

- affinity play: both audiences rank the other. Say how strong each direction is.
- one-way: one side's fans love the other, not the reverse. Say which way it runs and what that means for who pitches whom.
- contrast play: neither side's fans rank the other. That isn't a no; famous collabs often trade on contrast. Name what a contrast collab between these two could trade on (a surprising tone, a shared value, an unexpected audience), grounded in their tags if you can.

Then one sentence on where to launch: the overlap market with the highest combined over-index, with both numbers; if there is no overlap, say so and name A's top market.

Under 120 words. Plain text, no headings, no bold, no bullet points. Start with the class in a few words (for example "One-way: Liquid Death fans love Metallica, not the reverse."). Use only the numbers given.`;

const fmt = (d: Direction, who: string, fans: string) =>
  d.rank
    ? `${who} is #${d.rank} among ${fans} fans (affinity ${d.affinity?.toFixed(2)}; top-10 cutoff ${d.top10Cutoff?.toFixed(2)}, top-50 cutoff ${d.top50Cutoff?.toFixed(2)})`
    : `${who} is outside ${fans} fans' top 50 (affinity ${d.affinity?.toFixed(2) ?? "unknown"}; top-50 cutoff ${d.top50Cutoff?.toFixed(2)})`;

type VerdictInput = Omit<Pair, "verdict" | "cells">;

async function writeVerdict(p: VerdictInput): Promise<{ text: string; usage: LanguageModelUsage | null }> {
  const { text, usage } = await generateText({
    model: anthropic(MODEL),
    maxOutputTokens: 4000,
    providerOptions: { anthropic: { effort: "medium", fallbacks: "default" } },
    instructions: { role: "system", content: SYSTEM, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages: [
      {
        role: "user",
        content: [
          `A: ${p.a.name} (${p.a.type.replace("urn:entity:", "")}). ${p.a.short_description ?? ""}`,
          `B: ${p.b.name} (${p.b.type.replace("urn:entity:", "")}). ${p.b.short_description ?? ""}`,
          `Class: ${p.kind}${p.strongSide ? ` (carried by ${p.strongSide === "b" ? p.a.name : p.b.name} fans)` : ""}`,
          fmt(p.bAmongA, p.b.name, p.a.name),
          fmt(p.aAmongB, p.a.name, p.b.name),
          `Overlap markets: ${p.overlap.length ? p.overlap.slice(0, 5).map((o) => `${o.market} (${p.a.name} ${o.seed_over_index}, ${p.b.name} ${o.partner_over_index})`).join("; ") : "none"}`,
          `Shared tags: ${p.sharedTags.join(", ") || "none"}`,
          `${p.a.name} tags: ${p.aAmongB.tags.slice(0, 8).join(", ") || "none"}`,
          `${p.b.name} tags: ${p.bAmongA.tags.slice(0, 8).join(", ") || "none"}`,
        ].join("\n"),
      },
    ],
  });
  return { text: text.trim(), usage };
}
const verdictCached = cached("pair-verdict", (_v: string, p: VerdictInput) => writeVerdict(p));

export async function getPair(a: { id: string; type?: string | null }, b: { id: string; type?: string | null }): Promise<Pair | null> {
  const [A, B] = await Promise.all([getCard(a.id, a.type), getCard(b.id, b.type)]);
  if (!A || !B) return null;
  const [aAmongB, bAmongA, citiesA, citiesB] = await Promise.all([
    rankAmongFans(A, B.entity_id),
    rankAmongFans(B, A.entity_id),
    getCities(A.entity_id),
    getCities(B.entity_id).catch(() => null), // some entities have no US heatmap
  ]);
  const where = new Map(citiesA.metros.map((m) => [m.name, m])); // overlap markets are in A's ranked list
  const overlap = overlapMarkets(citiesA.metros, citiesB?.metros ?? []).map((o) => ({ ...o, lat: where.get(o.market)?.lat ?? 0, lon: where.get(o.market)?.lon ?? 0 }));
  const sharedTags = aAmongB.tags.filter((t) => bAmongA.tags.includes(t));
  const { kind, strongSide } = classify(aAmongB.rank, bAmongA.rank);
  const input: VerdictInput = { a: A, b: B, aAmongB, bAmongA, overlap, sharedTags, kind, strongSide };
  const { text } = await verdictCached("pair-v1", input);
  return { ...input, cells: citiesA.cells, verdict: text };
}
