// Break the checker (moonshots round 4, real Oct 18): a visitor edits the first call's reason as displayed, and the same
// checker that gates every answer re-checks the edit. Pure and client-safe, 0 calls.
import { checkDecision, displayName, type Check, type Decision, type StepRecord } from "./check.ts";

const BRACKET = /\[\[([^\]]+)\]\]/g;
// a run of capitalised words: a brand the visitor typed in ("Nike", "Warby Parker")
const CAPS = /\b[A-Z][\w'&.-]*(?:\s+[A-Z][\w'&.-]*)*/g;
const COMMON = new Set(["The", "It", "Its", "A", "An", "And", "But", "This", "That", "They", "Their", "Call", "First"]);

// The edited text back into the agent's form: names the agent bracketed get their brackets again, and any capitalised
// name the visitor added is bracketed too, so it has to be in a cited step. Without that, typing "Nike" over "Bombas"
// would pass (the published ceiling in check.ts: an unbracketed name no step returned can't be matched).
// ponytail: a new capitalised word at a sentence start is read as a name unless it's in COMMON; that rejects, never passes.
export function rebracket(original: string, shown: string, edited: string): string {
  const names = [...new Set([...original.matchAll(BRACKET)].map((m) => m[1]))].sort((a, b) => b.length - a.length);
  let raw = edited;
  names.forEach((n, i) => (raw = raw.split(displayName(n)).join(`\u0000${i}\u0000`)));
  raw = raw.replace(CAPS, (w) => {
    const words = w.split(/\s+/), lead: string[] = [];
    while (words.length && COMMON.has(words[0])) lead.push(words.shift()!); // "The Nike deal": The stays a word
    const name = words.join(" ");
    return [...lead, name && !shown.includes(name) ? `[[${name}]]` : name].filter(Boolean).join(" ");
  });
  names.forEach((n, i) => (raw = raw.split(`\u0000${i}\u0000`).join(`[[${n}]]`)));
  return raw;
}

export function checkEdit(decision: Decision, steps: StepRecord[], shown: string, edited: string): Check {
  const [first, ...rest] = decision.calls;
  return checkDecision({ ...decision, calls: [{ ...first, reason: rebracket(first.reason, shown, edited) }, ...rest] }, steps);
}

// one tap for a visitor who won't type: the first score, plus 0.03
export const nudge = (t: string) => t.replace(/(?<![\w.])\d+\.\d+/, (x) => (Number(x) + 0.03).toFixed(x.split(".")[1].length));
