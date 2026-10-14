// POST /api/ask's body: a name, or a Qloo id (UUID) with an entity type Crossover resolves. Nothing else reaches Qloo
// or the prompt (final review, Oct 13).
import { RESOLVE_TYPES } from "../qloo.ts";
import type { AskInput } from "./agent.ts";
import { REPLAY_ASK } from "./prepared.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAskBody(body: unknown): AskInput | null {
  const b = (body ?? {}) as { query?: unknown; id?: unknown; type?: unknown; case?: unknown };
  if (b.case !== undefined) return b.case === REPLAY_ASK.key ? { ...REPLAY_ASK.body, caseKey: REPLAY_ASK.key } : null;
  if (typeof b.id === "string" && typeof b.type === "string") return UUID.test(b.id) && RESOLVE_TYPES.includes(b.type) ? { id: b.id.toUpperCase(), type: b.type } : null;
  const q = typeof b.query === "string" ? b.query.trim() : "";
  return q && q.length <= 100 ? { query: q } : null;
}

// The cached body for a link's params, or null. The caller checks the cached ask resolved to the link's id.
export function bodyFromParams(id: string, sp: Record<string, string | string[] | undefined>): AskInput | null {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  if (one("case") !== undefined) {
    const b = parseAskBody({ case: one("case") });
    return b && b.id === id.toUpperCase() ? b : null;
  }
  if (one("q") !== undefined) return parseAskBody({ query: one("q") });
  return parseAskBody({ id, type: one("t") ?? "urn:entity:brand" });
}
