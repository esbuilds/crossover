// lib/ask/agent.ts
// Ask: one name in, Claude decides which tools to run and why, then calls decide. Every fact comes from the tools
// (lib/ask/tools.ts); the decision is checked against its cited steps (lib/ask/check.ts) before the page shows it.
// Cached per name or id and prompt version; a cached run replays its events with zero Qloo and zero model calls.
import { streamText, jsonSchema, tool, isStepCount, hasToolCall, type JSONSchema7 } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { MODEL } from "../agent/rank.ts";
import { streamCache, type Streamed } from "../agent/stream-cache.ts";
import { makeTools, qlooDeps } from "./tools.ts";
import { checkDecision, type Check, type Decision, type StepRecord } from "./check.ts";

export type AskInput = { query?: string; id?: string; type?: string };
export type AskEvent =
  | { type: "call"; n: number; tool: string; why: string }
  | { type: "result"; n: number; summary: string; output: unknown }
  | { type: "decision"; decision: Decision | null; check: Check }
  | { type: "done"; cached: boolean }
  | { type: "error"; message: string };

export const ASK_VERSION = "ask-v1.6"; // v1.5-1.6: score binding limited to the clause after the first brand, method numbers exempt // v1.4: final review fixes (step numbers owned by the loop, resolve outputs, score-to-brand binding) // v1.3: outputs state the method numbers (top 50, 0.05) // v1.1: split names both sides, checker fixes (first live run). v1.2: no grouping places into regions
const MAX_TOOLS = 8;

const SYSTEM = `You decide which brands a partnerships team should call first, for one name the visitor gives you. You can only measure through the tools. You never add a fact the tools didn't return.

Before every tool call, put one plain sentence in the tool's "why" field saying what you need to know and why.

Path:
1. resolve the name. If it is ambiguous or unknown, call decide right away with no calls and one summary sentence saying which options Qloo has (or that Qloo doesn't know it), citing the resolve step.
2. findRival. If it finds one, run split, then candidates with source "split". If not, candidates with source "top50".
3. review the eight candidate ids exactly as candidates returned them.
4. twins, to check whether two contenders reach the same audience.
5. decide.

Deciding: up to three calls, from the review's clear three, or from its top group when there is no clear three (then say there is no clear three, and use twins to say which two not to call together). A double is a caution, never a reason to drop a name. If fewer than four candidates were measured, make no calls and say there isn't enough to call a three.

Writing: wrap every brand, artist or show name in double brackets, like [[Oreo]]. Use only numbers that appear in the steps you cite, with two decimals for scores. Name places and brands exactly as the steps give them; never group them into regions or describe what kind of brand they are. Say "sits closer to", never "prefers" or "wins". No percentages. Each reason and sentence is one short sentence and cites the step numbers it rests on. Steps are numbered in the order you ran them, starting at 1.`;

export function finalize(decision: Decision | null, steps: StepRecord[]): { decision: Decision | null; check: Check } {
  if (!decision) return { decision: null, check: { ok: false, problems: ["The agent stopped before deciding."] } };
  return { decision, check: checkDecision(decision, steps) };
}

const why = { why: { type: "string", description: "One plain sentence: what this step finds out and why you need it now." } } as const;
const obj = (props: Record<string, JSONSchema7>, required: string[]): JSONSchema7 => ({ type: "object", properties: props, required, additionalProperties: false });
const cited: JSONSchema7 = { type: "object", properties: { text: { type: "string" }, steps: { type: "array", items: { type: "integer" } } }, required: ["text", "steps"], additionalProperties: false };

async function generate(input: AskInput, say: (t: string) => void, write: (d: string) => void, ip: string): Promise<Streamed> {
  const trace: string[] = [];
  const emit = (e: AskEvent) => { const s = JSON.stringify(e); trace.push(s); say(s); };
  const steps: StepRecord[] = [];
  const t = makeTools(qlooDeps(ip), (s) => { steps.push(s); emit({ type: "result", n: s.n, summary: s.summary, output: s.output }); });
  let decision: Decision | null = null;
  let calls = 0;
  const guard = <A, R>(name: string, fn: (a: A, at: number) => Promise<R>) => async (a: A) => {
    if (calls >= MAX_TOOLS) return { error: "out of steps; call decide now" };
    const at = ++calls; // the loop owns step numbers (parallel calls finish out of order)
    emit({ type: "call", n: at, tool: name, why: (a as { why?: string }).why ?? "" });
    return (await fn(a, at) as { output: object }).output;
  };

  const result = streamText({
    model: anthropic(MODEL),
    maxOutputTokens: 8000,
    providerOptions: { anthropic: { effort: "medium", fallbacks: "default", disableParallelToolUse: true } },
    stopWhen: [hasToolCall("decide"), isStepCount(MAX_TOOLS + 2)],
    instructions: { role: "system", content: SYSTEM, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    prompt: input.id ? `The visitor picked the Qloo entity ${input.id} (${input.type}). Resolve it by id.` : `Who should "${(input.query ?? "").slice(0, 100)}" call first?`,
    tools: {
      resolve: tool({ description: "Find the name in Qloo. Exact names confirm; anything else returns options.", inputSchema: jsonSchema<{ why: string; name?: string; id?: string; type?: string }>(obj({ ...why, name: { type: "string" }, id: { type: "string" }, type: { type: "string" } }, ["why"])), execute: guard("resolve", t.resolve) }),
      findRival: tool({ description: "The closest same-field brand in the seed's fans' top 50 (genre tag, then Qloo product category).", inputSchema: jsonSchema<{ why: string }>(obj(why, ["why"])), execute: guard("findRival", t.findRival) }),
      split: tool({ description: "Seed vs rival: each side's top 50 brands scored under both names; which sit closer to each side, and each side's top markets.", inputSchema: jsonSchema<{ why: string }>(obj(why, ["why"])), execute: guard("split", t.split) }),
      candidates: tool({ description: "Eight candidate brands by rule. source 'split': the seed's side of the split, widest gap first. source 'top50': the seed's fans' top 50 minus its own field.", inputSchema: jsonSchema<{ why: string; source: "split" | "top50" }>(obj({ ...why, source: { type: "string", enum: ["split", "top50"] } }, ["why", "source"])), execute: guard("candidates", t.candidates) }),
      review: tool({ description: "Score the candidate ids under the seed's fans: groups within 0.05, a clear three or not, fame bands, two-way ranks.", inputSchema: jsonSchema<{ why: string; ids: string[] }>(obj({ ...why, ids: { type: "array", items: { type: "string" } } }, ["why", "ids"])), execute: guard("review", t.review) }),
      twins: tool({ description: "Among the review's contenders, the pair whose audiences sit closest to each other, if one stands out by 0.05.", inputSchema: jsonSchema<{ why: string }>(obj(why, ["why"])), execute: guard("twins", t.twins) }),
      decide: tool({
        description: "Your final answer. Calls, cautions and summary sentences, each citing step numbers.",
        inputSchema: jsonSchema<Decision>(obj({
          calls: { type: "array", maxItems: 3, items: obj({ name: { type: "string" }, reason: { type: "string" }, steps: { type: "array", items: { type: "integer" } } }, ["name", "reason", "steps"]) },
          cautions: { type: "array", items: cited }, summary: { type: "array", items: cited },
        }, ["calls", "cautions", "summary"])),
        execute: async (d) => ((decision = d), "recorded"),
      }),
    },
  });
  for await (const part of result.stream) {
    if (part.type === "tool-error" || part.type === "error") throw (part as { error: unknown }).error;
  }
  const final = finalize(decision, steps);
  emit({ type: "decision", ...final });
  write(JSON.stringify(final));
  return { text: JSON.stringify(final), trace };
}

const keyOf = (i: AskInput) => (i.id ? i.id.toUpperCase() : (i.query ?? "").trim().toLowerCase());
// ASK_TOOLS bumps when tool outputs change without the prompt changing (t2, Oct 13: ids for the step 3 map and /vs link)
export const ASK_TOOLS = "t2";
const run = streamCache<AskInput, Streamed>("ask", `${ASK_VERSION}+${ASK_TOOLS}`, keyOf, generate);

export async function ask(input: AskInput, ip: string, onEvent: (e: AskEvent) => void) {
  const r = await run(input, ip, (s) => onEvent(JSON.parse(s)), () => {});
  const events: AskEvent[] = r.trace.map((s) => JSON.parse(s));
  if (!r.ran) for (const e of events) onEvent(e);
  return { ran: r.ran, events };
}
