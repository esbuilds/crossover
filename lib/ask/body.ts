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
