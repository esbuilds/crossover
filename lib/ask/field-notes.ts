// Field notes (Fable's checker sign-off, real Oct 15): two code lines from the same fields() the candidates cut uses, so
// a note and the cut can never disagree. "cut": the field the cut left out, by Qloo's tag name ("Own field left out:
// Baseball"), so NFL teams under the Dodgers read as the rule's limit, not a slip. "shared": when the seed has no specific
// tag the cut had nothing to run on, and a call shares a Qloo genre tag with it (Chipotle and MOD Pizza: dining).
// Cache first (the rival finder already read both lists); a cold lookup spends the visitor's allowance.
import { insights, type Entity } from "../qloo.ts";
import { fields } from "../rivals.ts";
import { Cold, warmFirst } from "../review-run.ts";
import { spendColdPair } from "../rivals.ts";
import type { AskEvent } from "./agent.ts";
import { nameForDisplay } from "./check.ts";
import { decisionEvent, stepsFrom } from "./steps.ts";

export type FieldNotes = { cut: string | null; shared: string | null };
const BRAND = "urn:entity:brand";
const GENRE = "urn:tag:genre:brand:";
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0]);

export function fieldNotes(seed: Entity, top: Entity[], calls: string[]): FieldNotes {
  const own = fields(seed);
  if (own.size) {
    const names = seed.tags.filter((t) => own.has(t.tag_id)).map((t) => t.name);
    // persona round 2 (Sweetgreen got Dig Inn): name the wider Qloo category the cut didn't exclude
    const wider = [...new Set([...own].map((f) => f.split(":").slice(0, 5).join(":")))].flatMap((id) => seed.tags.filter((t) => t.tag_id === id).map((t) => t.name.toLowerCase()));
    const not = wider.length ? ` Qloo's wider category, ${list(wider)}, was not.` : "";
    return { cut: names.length ? `Own field left out: ${list(names)}.${not}` : null, shared: null };
  }
  const mine = seed.tags.filter((t) => t.tag_id.startsWith(GENRE));
  const hits = calls.flatMap((n) => {
    const e = top.find((x) => nameForDisplay(x.name) === n);
    const tag = e && mine.find((m) => e.tags.some((t) => t.tag_id === m.tag_id));
    return tag ? [{ n, tag: tag.name.toLowerCase() }] : [];
  });
  if (!hits.length) return { cut: null, shared: null };
  const tags = [...new Set(hits.map((h) => h.tag))];
  const only = mine.length === 1 ? "only " : "";
  return { cut: null, shared: `The same-field cut had no specific tag to run on for ${seed.name}; ${list(hits.map((h) => h.n))} ${hits.length > 1 ? "share" : "shares"} its ${only}Qloo tag, ${list(tags)}. The audit lists this limit.` };
}

const must = <T,>(v: T | null): T => { if (v === null) throw new Cold(); return v; };

// ip null: cache only, never a call (the sheet)
export async function fieldNotesFor(events: AskEvent[], ip: string | null): Promise<FieldNotes | null> {
  const steps = stepsFrom(events);
  const seed = steps.find((s) => s.tool === "resolve")?.output as { id?: string; type?: string } | undefined;
  const source = (steps.find((s) => s.tool === "candidates")?.output as { source?: string } | undefined)?.source;
  const d = decisionEvent(events);
  // the cut runs on brand genre tags, and only on the split and top-50 paths (the replay case's eight are a fixed list)
  if (!seed?.id || seed.type !== BRAND || (source !== "split" && source !== "top50") || !d?.check.ok || !d.decision) return null;
  const calls = d.decision.calls.map((c) => nameForDisplay(c.name));
  const run = async (mode: "peek" | "live") => {
    const get = (p: Record<string, string | number>) => (mode === "peek" ? insights.peek(p).then(must) : insights(p)) as Promise<Entity[]>;
    const [card] = await get({ "filter.type": BRAND, "filter.results.entities": seed.id!, take: 1 });
    return card ? fieldNotes(card, await get({ "filter.type": BRAND, "signal.interests.entities": seed.id!, take: 50 }), calls) : null;
  };
  if (ip === null) return run("peek").catch((e) => { if (e instanceof Cold) return null; throw e; });
  return warmFirst(run, () => spendColdPair(ip));
}
