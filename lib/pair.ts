// Resolve a (seed, pick) pair from a request body for /api/brief and /api/outreach. Only ids come from the
// caller; names and numbers are looked up server-side from the cached slate. The only caller text that reaches
// a prompt is a proxy-mode brand's own name and description, length-capped.
import { DOMAINS, getSlate, getCard, toCard, type Domain, type Slate, type Card } from "./slate.ts";
import { fixtureById } from "./fixtures.ts";
import { parseProxies, parseTag } from "./proxy-params.ts";
import type { BriefInput } from "./agent/brief.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PairBody = { entity?: string; type?: string; pick?: string; domain?: Domain; proxy?: { name?: string; d?: string; p?: string; t?: string } };

export async function loadPair(body: PairBody): Promise<BriefInput | { error: string; status: number }> {
  const { entity, type, pick, domain, proxy } = body;
  const signals = parseProxies(typeof proxy?.p === "string" ? proxy.p : null);
  const proxyName = typeof proxy?.name === "string" ? proxy.name.trim().slice(0, 80) : "";
  if (!(UUID.test(entity ?? "") || (signals && proxyName)) || !pick || !UUID.test(pick) || !domain || !DOMAINS.includes(domain))
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
    slate = await getSlate(signals, undefined, parseTag(typeof proxy?.t === "string" ? proxy.t : null)); // same args as the run, so cached
  } else {
    const fx = fixtureById(entity!);
    if (fx && fx.resolution.status === "confident") [seed, slate] = [toCard(fx.resolution.match), fx.slate];
    else [seed, slate] = await Promise.all([getCard(entity!, type ?? null), getSlate(entity!)]); // both cached since the run
  }
  const picks = slate[domain];
  const at = picks.findIndex((p) => p.entity_id === pick);
  if (!seed || at < 0) return { error: "That pick isn't in this slate", status: 404 };
  return { seed, seedSignal: signals ?? entity!, pick: picks[at], domain, slateRank: at + 1, slateSize: picks.length, anchor, basedOn };
}
