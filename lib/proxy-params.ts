// Proxy weights and share-link params. No runtime imports, so the browser can use them too.
import type { Signal } from "./qloo.ts";

export const MAX_PROXIES = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// First proxy (the user's top pick) carries the most weight; the rest share a lower one.
export const weightsFor = (ids: string[]): Signal[] => ids.slice(0, MAX_PROXIES).map((id, i) => ({ id, weight: i === 0 ? 10 : 5 }));

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
