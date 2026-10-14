// The checker's blocked answers, recovered from the cache under the prompt versions that produced them (0 Qloo calls),
// written as derived records (the sentence, the steps it cited, the checker's reason) to lib/ask/blocked.json. One source
// for /audit's list and the call sheet's count.
//   node --env-file=.env.local scripts/blocked-extract.ts
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { getJson } from "../lib/redis.ts";

const MJ = { id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: "urn:entity:artist" };
const RUNS: { version: string; input: object; label: string; note?: string }[] = [
  { version: "ask-v1", input: { query: "Liquid Death" }, label: "Liquid Death, first live run" },
  { version: "ask-v1.2", input: { id: "6647FB92-9390-4B58-885B-86D96FF5BB6D", type: "urn:entity:brand" }, label: "Olipop" },
  { version: "ask-v1.2", input: MJ, label: "Mt. Joy" },
  { version: "ask-v1.4", input: MJ, label: "Mt. Joy", note: "the score-binding rule was then narrowed: the number was the method's gap, not a brand's score" },
  { version: "ask-v1.5", input: MJ, label: "Mt. Joy", note: "the score-binding rule was then narrowed: the sentence was a group range, not one brand's score" },
  { version: "ask-v1.6+t2", input: MJ, label: "Mt. Joy, re-warm after the popularity fix (real Oct 14)", note: "the numbers after Outdoor Voices described the other seven; the binding rule reads them as Outdoor Voices' own" },
];
type Cited = { text: string; steps: number[] };
type Decision = { calls: { name: string; reason: string; steps: number[] }[]; cautions: Cited[]; summary: Cited[] };
const out = [];
for (const r of RUNS) {
  const key = `cx:ask:${createHash("sha1").update(JSON.stringify([r.version, r.input])).digest("hex")}`;
  const hit = await getJson<{ text: string }>(key);
  if (!hit) { console.log("MISSING", r.label, r.version); continue; }
  const { decision, check } = JSON.parse(hit.text) as { decision: Decision; check: { ok: boolean; problems?: string[] } };
  if (check.ok) { console.log("NOT BLOCKED", r.label, r.version); continue; }
  const at = (label: string) => {
    const [kind, n] = label.split(" ");
    const i = Number(n) - 1;
    return kind === "call" ? { text: decision.calls[i].reason, steps: decision.calls[i].steps } : (kind === "caution" ? decision.cautions : decision.summary)[i];
  };
  const failures = [...new Set(check.problems!.map((p) => p.split(":")[0]))].map((label) => ({ where: label, ...at(label), reasons: check.problems!.filter((p) => p.startsWith(label + ":")).map((p) => p.slice(label.length + 2)) }));
  out.push({ ask: r.label, version: r.version, note: r.note ?? null, failures });
  console.log("BLOCKED", r.label, r.version, failures.length, "sentences");
}
writeFileSync("lib/ask/blocked.json", JSON.stringify(out, null, 2) + "\n");
