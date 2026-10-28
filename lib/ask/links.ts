// Client-safe (no Qloo client here; lib/client-imports.test.ts guards it).
// Links to an ask and its sheet carry what was asked (a typed ask is cached under the typed name,
// so an id-only link found nothing): ?q= for a typed name, ?case= for the replay case, else the id and type alone.
export type Asked = { query: string } | { case: string } | { id: string; type: string };
export function askLinks(asked: Asked, resolved: { id: string; type: string }) {
  const q = new URLSearchParams({ t: resolved.type });
  if ("query" in asked) q.set("q", asked.query);
  if ("case" in asked) q.set("case", asked.case);
  return { share: `/ask/${resolved.id}?${q}`, sheet: `/ask/${resolved.id}/sheet?${q}`, pitch: `/ask/${resolved.id}/pitch?${q}` };
}

