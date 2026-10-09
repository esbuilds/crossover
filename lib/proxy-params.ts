// Proxy weights and share-link params. No runtime imports, so the browser can use them too.
import type { Signal } from "./qloo.ts";

export const MAX_PROXIES = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The user's top pick carries the most weight, the second a bit less, the rest share a lower one (10, 7, 5).
export const weightsFor = (ids: string[]): Signal[] => ids.slice(0, MAX_PROXIES).map((id, i) => ({ id, weight: [10, 7][i] ?? 5 }));

// Brand-category tag (from /v2/tags with a brand parent) that keeps a proxy slate in the seed's category.
// Weighted below the proxies so they still lead.
export const TAG_WEIGHT = 3;
export const parseTag = (t: string | null) => (t && /^urn:tag:[a-z0-9_:]{3,150}$/.test(t) ? t : null);

// Share links carry proxies as "id:10,id:5". Anything malformed is rejected, not repaired: this is a trust boundary.
export function parseProxies(param: string | null): Signal[] | null {
  if (!param) return null;
  const parts = param.split(",");
  if (!parts.length || parts.length > MAX_PROXIES) return null;
  const signals = parts.map((p) => {
    const [id, w] = p.split(":");
    const weight = Number(w);
    return UUID.test(id ?? "") && Number.isInteger(weight) && weight >= 1 && weight <= 100 ? { id, weight } : null;
  });
  if (signals.some((s) => !s) || new Set(signals.map((s) => s!.id)).size !== signals.length) return null;
  return signals as Signal[];
}
export const formatProxies = (signals: Signal[]) => signals.map((s) => `${s.id}:${s.weight}`).join(",");
