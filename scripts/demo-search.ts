// The resolver tests' search table without Qloo's results in it (W2, real Oct 25). scripts/record-fixtures.ts records
// /search into fixtures/demo/search.json (gitignored); this writes fixtures/search.json from it, keeping what the
// resolver reads (each word's token against the query's, types, the two facts in lib/fixture-facts.ts) and nothing of
// which entities Qloo returned: every query is ours (fixtures/brands.txt), a hit's name keeps the query's own words,
// stop words and punctuation, every other word becomes an invented one (the same word each time), and ids are fresh.
//   node --disable-warning=ExperimentalWarning scripts/demo-search.ts [recorded.json] <map-out.json>
import { randomInt, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tokens } from "../lib/resolve.ts";
import type { Recorded } from "../lib/fixture-facts.ts";

const src = process.argv[2] ?? new URL("../fixtures/demo/search.json", import.meta.url).pathname;
const recorded: Record<string, Recorded[]> = JSON.parse(readFileSync(src, "utf8"));
const queryTokens = new Set(Object.keys(recorded).flatMap(tokens));
const SYL = ["ba", "ke", "lo", "mi", "nu", "ra", "so", "ti", "vo", "ze", "dar", "fen", "gol", "hap", "jor", "kel", "mup", "nob", "pell", "quin", "rost", "sev", "tam", "vex", "wim"];
const words = new Map<string, string>(), used = new Set<string>();
const invent = (t: string) => {
  if (!words.has(t)) {
    let w = "";
    while (!w || used.has(w) || queryTokens.has(w)) w = Array.from({ length: 2 + randomInt(2) }, () => SYL[randomInt(SYL.length)]).join("");
    used.add(w);
    words.set(t, w);
  }
  return words.get(t)!;
};
const ids = new Map<string, string>();
const out = Object.fromEntries(Object.entries(recorded).map(([q, hits]) => {
  const keep = new Set(tokens(q));
  return [q, hits.map((h) => {
    const name = h.name.replace(/[\p{L}\p{N}'’]+/gu, (word) => {
      const t = tokens(word).join(" ");
      if (!t || keep.has(t)) return word;
      const w = invent(t);
      return word[0] === word[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w;
    });
    ids.set(h.entity_id, ids.get(h.entity_id) ?? randomUUID().toUpperCase());
    return { ...h, name, entity_id: ids.get(h.entity_id)! };
  })];
}));
writeFileSync(new URL("../fixtures/search.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
writeFileSync(process.argv[3] ?? "demo-search-map.json", JSON.stringify({ ids: Object.fromEntries(ids) }, null, 1));
console.log(`fixtures/search.json: ${Object.keys(out).length} queries, ${ids.size} entities renamed`);
