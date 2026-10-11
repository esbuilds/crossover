// Match validation (PLAN.md section 3). /search returns confident wrong matches
// (Fruition Chocolate Works -> Bath & Body Works), so never trust the top hit and never rank by popularity.
// Deterministic first, Haiku only in the ambiguous band, the user always sees the card.
import { generateText, jsonSchema, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { Entity } from "./qloo";

export type Resolution =
  | { status: "confident"; match: Entity; alternates: Entity[]; via: "exact" | "llm"; reason?: string }
  | { status: "ambiguous"; candidates: Entity[] }
  | { status: "not_found" };

// null means "no opinion available" (no key, API error); the caller keeps the result ambiguous.
export type Judge = (query: string, candidates: Entity[]) => Promise<{ index: number | null; reason: string } | null>;

// PLAN.md list, plus joiners (and/of/by/x) so "Fly By Jing" and "Savage X Fenty By Rihanna" don't share a token
const POPULARITY_FLOOR = 0.3; // same threshold PLAN.md suggests for filter.popularity.min
const STOP = new Set(["the", "co", "inc", "brand", "works", "company", "and", "of", "by", "x"]);

export const tokens = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !STOP.has(t));

const norm = (s: string) => tokens(s).join(" ");
const names = (e: Entity) => [e.name, ...e.akas];
const shared = (q: string[], c: string[]) => q.filter((t) => c.includes(t)).length;
const isSubset = (a: string[], b: string[]) => a.length > 0 && a.every((t) => b.includes(t));

export async function resolve(query: string, candidates: Entity[], judge: Judge | null = haikuJudge): Promise<Resolution> {
  const q = tokens(query);
  if (!q.length || !candidates.length) return { status: "not_found" };

  // 1-2. exact on name or any aka. Several exact hits keep Qloo's search order (relevance, not popularity).
  // Popularity is a floor, never a rank: an exact name on a near-zero-popularity entity is usually a namesake
  // (searching "Graza" finds a Polish colorist at popularity 0), so it gets a card and a question instead.
  const exact = candidates.filter((c) => names(c).some((n) => norm(n) === q.join(" ")));
  const known = exact.filter((c) => c.popularity >= POPULARITY_FLOOR);
  // Musicians come back twice with the exact name: a person and an artist, sometimes as separate entities with the
  // person first (Taylor Swift). Crossover means the act, and the artist is the one with a music audience (Oct 25).
  if (known.length) {
    // A person matched only through an alias steps aside (Stan Lee carries the alias "Stanley"); brands keep their
    // aliases ("Chelsea FC" is the club's alias).
    const viaAlias = (c: Entity) => c.types.includes("urn:entity:person") && norm(c.name) !== q.join(" ");
    const pool = known.some((c) => !viaAlias(c)) ? known.filter((c) => !viaAlias(c)) : known;
    // Qloo's order decides among exact names (YETI the brand before Yeti the artist), except on a person/artist tie
    // (Oct 12, brief-oct12-rival2): the more popular entity wins, and within 0.1 the artist (Taylor Swift, Oct 25),
    // so "Cedric the Entertainer" lands on the person (0.94) over his comedy-album artist entity (0.37).
    const person = pool.find((c) => c.types.includes("urn:entity:person"));
    const artist = pool.find((c) => c.types.includes("urn:entity:artist"));
    const pick = person && artist && (pool[0] === person || pool[0] === artist) ? (person.popularity > artist.popularity + 0.1 ? person : artist) : pool[0];
    // An exact name that a known entity of another type also carries asks which one (review-v3's rule, ported Oct 11
    // after the held-out audit: Corona confirmed to the band, Mars to an artist). Same-type duplicates keep Qloo's
    // order, and a musician's person/artist pair is one act. A rival needs the exact name as its primary name, never
    // an alias (Oct 11 gate: "Metallica Through the Never" carries the alias "Metallica"). Types skip the bare
    // "urn:entity" Qloo sometimes lists first.
    const musician = (c: Entity) => c.types.some((t) => t === "urn:entity:artist" || t === "urn:entity:person");
    const kind = (c: Entity) => c.types.find((t) => t !== "urn:entity");
    const rivals = pool.filter(
      (c) => c !== pick && norm(c.name) === q.join(" ") && kind(c) !== kind(pick) && !(musician(c) && musician(pick)),
    );
    if (rivals.length) return { status: "ambiguous", candidates: [pick, ...rivals].slice(0, 3) };
    return { status: "confident", match: pick, alternates: candidates.filter((c) => c !== pick).slice(0, 2), via: "exact" };
  }
  if (exact.length) return { status: "ambiguous", candidates: exact.slice(0, 3) };

  // 3. token subset either way with at least two shared tokens: likely, let the user pick
  const likely = candidates.filter((c) =>
    names(c).some((n) => {
      const t = tokens(n);
      return (isSubset(q, t) || isSubset(t, q)) && shared(q, t) >= 2;
    }),
  );
  if (likely.length) return { status: "ambiguous", candidates: likely.slice(0, 3) };

  // 4. ambiguous band: some name overlap but no structural match. Zero overlap is not found without asking.
  const band = candidates.filter((c) => names(c).some((n) => shared(q, tokens(n)) > 0)).slice(0, 3);
  if (!band.length) return { status: "not_found" };

  const verdict = judge ? await judge(query, band) : null;
  if (!verdict) return { status: "ambiguous", candidates: band };
  if (verdict.index !== null && band[verdict.index] && verdict.reason) {
    const match = band[verdict.index];
    return { status: "confident", match, alternates: band.filter((c) => c !== match), via: "llm", reason: verdict.reason };
  }
  // 5. no acceptance
  return { status: "not_found" };
}

export const haikuJudge: Judge = async (query, candidates) => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const list = candidates
    .map((c, i) => `${i}. ${c.name} (${c.types.join(", ")}) - ${c.short_description ?? "no description"}. Tags: ${c.tags.map((t) => t.name).join(", ") || "none"}`)
    .join("\n");
  try {
    const { output } = await generateText({
      model: anthropic("claude-haiku-5-5"),
      providerOptions: { anthropic: { effort: "low" } },
      output: Output.object({
        schema: jsonSchema<{ index: number | null; reason: string }>({
          type: "object",
          properties: {
            index: { type: ["integer", "null"], description: "Index of the candidate that is the same entity, or null if none is" },
            reason: { type: "string", description: "One sentence: why it is or is not the same entity" },
          },
          required: ["index", "reason"],
          additionalProperties: false,
        }),
      }),
      prompt: `A user typed "${query}" to find a brand, artist, show, person, or place. A search engine returned these candidates:\n${list}\n\nIs any candidate the same real-world entity the user meant, not just one with a similar name? Answer null unless you are confident. A different company that shares a word with the query is not a match.`,
    });
    return output;
  } catch (err) {
    console.error("[resolve] haiku judge failed", err);
    return null;
  }
};
