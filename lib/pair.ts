// Resolve a (seed, pick) pair from a request body for /api/brief and /api/outreach. Only ids come from the
// caller; names and numbers are looked up server-side from the cached slate. The only caller text that reaches
// a prompt is a proxy-mode brand's own name and description, length-capped.
import { DOMAINS, getSlate, getCard, toCard, isEntityType, type Domain, type Slate, type Card, type RefineHook } from "./slate.ts";
import { fixtureById } from "./fixtures.ts";
import { parseProxies, parseTag } from "./proxy-params.ts";
import type { BriefInput } from "./agent/brief.ts";
import { rankAmongFans } from "./fit.ts";
import { appliedSentence, interpret, refineParams, relaxedParams } from "./refine.ts";
import { playbookFor } from "./playbook.ts";

// Partners can be any slate domain, plus people (pairing mode: "Liquid Death x Martha Stewart").
const PARTNER_KINDS: string[] = [...DOMAINS, "person"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PairBody = { entity?: string; type?: string; pick?: string; domain?: string; c?: string; proxy?: { name?: string; d?: string; p?: string; t?: string } };

export async function loadPair(body: PairBody): Promise<BriefInput | { error: string; status: number }> {
  const { entity, type, pick, domain, proxy } = body;
  const refineText = typeof body.c === "string" ? body.c.trim().slice(0, 200) : "";
  // refined runs: rebuild the same refined slate (interpretation and Qloo calls are cached from the run)
  let constraints: string | undefined; // the applied constraints, for the brief's venue choice
  let region: BriefInput["region"]; // the refine's launch region, so the brief's markets stay inside it
  const hookFor = async (name: string, kind: string): Promise<RefineHook | null> => {
    if (!refineText) return null;
    const set = await interpret(name, kind, refineText);
    const label = set.applied.find((x) => x.kind === "region")?.label;
    if (set.states?.length && label) region = { label, states: set.states };
    constraints = appliedSentence(set) || undefined;
    return { paramsFor: (d) => refineParams(set, d), relaxedFor: (d) => relaxedParams(set, d), excludeIds: set.excludeIds };
  };
  const signals = parseProxies(typeof proxy?.p === "string" ? proxy.p : null);
  const proxyName = typeof proxy?.name === "string" ? proxy.name.trim().slice(0, 80) : "";
  if (!((UUID.test(entity ?? "") && isEntityType(type)) || (signals && proxyName)) || !pick || !UUID.test(pick) || !domain || !PARTNER_KINDS.includes(domain))
    return { error: "entity (or proxy), pick, and domain are required", status: 400 };

  let seed: Card | null;
  let slate: Slate;
  let anchor: Card | undefined;
  let basedOn: string[] | undefined;
  if (signals) {
    const cards = await Promise.all(signals.map((s) => getCard(s.id, "urn:entity:brand"))); // cached since the run
    if (cards.some((c) => !c)) return { error: "Unknown proxy", status: 404 };
    anchor = cards[0]!;
    basedOn = cards.map((c) => c!.name);
    seed = { entity_id: "proxy", name: proxyName, type: "proxy", popularity: 0, short_description: typeof proxy?.d === "string" ? proxy.d.trim().slice(0, 300) : undefined };
    slate = await getSlate(signals, undefined, parseTag(typeof proxy?.t === "string" ? proxy.t : null), await hookFor(proxyName, "brand")); // same args as the run, so cached
  } else {
    const fx = refineText ? null : fixtureById(entity!);
    if (fx && fx.resolution.status === "confident") [seed, slate] = [toCard(fx.resolution.match), fx.slate];
    else if (refineText) {
      seed = await getCard(entity!, type ?? null);
      slate = seed ? await getSlate(entity!, undefined, null, await hookFor(seed.name, playbookFor(seed.type).noun)) : ({} as Slate);
    } else [seed, slate] = await Promise.all([getCard(entity!, type ?? null), getSlate(entity!)]); // both cached since the run
  }
  if (!seed) return { error: "Unknown entity", status: 404 };
  const picks = slate[domain as Domain] ?? [];
  const at = picks.findIndex((p) => p.entity_id === pick);
  if (at >= 0) return { seed, seedSignal: signals ?? entity!, pick: picks[at], domain, slateRank: at + 1, slateSize: picks.length, fromSlate: true, anchor, basedOn, ...(region ? { region } : {}), ...(constraints ? { constraints } : {}) };

  // Pairing mode: any partner, not only slate picks. Forward fit becomes its rank among the seed's fans' top 50
  // (lib/fit.ts, cached and shared with /api/pair). Proxy seeds have no Qloo id for that, so they stay slate-only.
  if (signals) return { error: "That pick isn't in this slate", status: 404 };
  const card = await getCard(pick, `urn:entity:${domain}`);
  if (!card) return { error: "Qloo has no entity with that id", status: 404 };
  const fit = await rankAmongFans(card, seed.entity_id);
  const partner = { entity_id: card.entity_id, name: card.name, type: card.type, affinity: fit.affinity ?? 0, popularity: card.popularity, image: card.image, short_description: card.short_description, tags: fit.tags.slice(0, 5) };
  return { seed, seedSignal: entity!, pick: partner, domain, slateRank: fit.rank, slateSize: 50, fromSlate: false };
}
