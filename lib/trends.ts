// Moment vs durable (PLAN.md section 2 step 6, Oct 22): the seed's brand list fetched twice more, once with trend
// lift switched off and once at its strongest. 2 Qloo calls per seed, cached under trends-v1.
import { cached, insights, insightsPost, type Signal } from "./qloo.ts";
import { TAG_WEIGHT } from "./proxy-params.ts";

export type Trend = "durable" | "trending";

// Pure. A kept brand that stays in the top ten with trends off is durable; one that only shows up with trends at
// very high is trending. When both runs return the same ten, trends move nothing here and no brand gets a chip.
export function classifyTrends(kept: string[], off: string[], high: string[]): Record<string, Trend> {
  const same = off.length === high.length && off.every((id) => high.includes(id));
  if (same) return {};
  const out: Record<string, Trend> = {};
  for (const id of kept) {
    if (off.includes(id)) out[id] = "durable";
    else if (high.includes(id)) out[id] = "trending";
  }
  return out;
}

// Same shape as the slate's brand call (lib/slate.ts getSlate), minus explainability, plus bias.trends.
async function brandIds(seed: string | Signal[], bias: "off" | "very_high", tag?: string | null) {
  const params = { take: 10, "bias.trends": bias };
  const list =
    typeof seed === "string"
      ? await insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": seed, "filter.exclude.entities": seed, ...params })
      : await insightsPost("urn:entity:brand", seed, { ...params, ...(tag ? { "signal.interests.tags": [{ tag, weight: TAG_WEIGHT }] } : {}) });
  return list.map((e) => e.entity_id);
}

const brandTrendLists = cached("trends", async (_v: string, seed: string | Signal[], tag: string | null) => ({
  off: await brandIds(seed, "off", tag),
  high: await brandIds(seed, "very_high", tag),
}));

export async function brandTrends(seed: string | Signal[], kept: string[], tag?: string | null) {
  const { off, high } = await brandTrendLists("trends-v1", seed, tag ?? null);
  return classifyTrends(kept, off, high);
}
