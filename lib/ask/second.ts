// lib/ask/second.ts
// The second look (AGENT-1 with AGENT-4, moonshot round 2, real Oct 22). Beside a cached ask, never instead of it: the
// frozen answer stays the answer of record. The agent reads the frozen steps and decision, chooses whether to measure the
// other direction (otherWay: where each candidate's own fans rank the seed), then keeps, changes or declines its calls.
// The checker runs on the result; a "no" is fed back once as a visible "check" event. Own cache family (look-v1).
import { streamText, jsonSchema, tool, isStepCount, type JSONSchema7, type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { insights, type Entity } from "../qloo.ts";
import { MODEL } from "../agent/rank.ts";
import { streamCache, type Streamed } from "../agent/stream-cache.ts";
import { askCaseForScript, peekAsk, type AskEvent, type AskInput } from "./agent.ts";
import type { Candidate } from "./candidates.ts";
import { checkDecision, claimCount, unbracket, type Check, type Decision, type StepRecord } from "./check.ts";
import { decisionEvent, stepsFrom } from "./steps.ts";

export const LOOK_VERSION = "look-v1";
const MAX_MEASURES = 2; // otherWay: once to look, once more after a checker "no"
export type Outcome = "kept" | "changed" | "declined" | "blocked";
export type LookEvent =
  | Extract<AskEvent, { type: "call" | "result" | "decision" }>
  | { type: "check"; problems: string[] }
  | { type: "look"; outcome: Outcome; frozen: string[]; calls: string[]; measured: boolean; checkFed: boolean; citedLess: boolean };

const SYSTEM = `You take a second look at a decision this agent already made for one name. Its steps and its decision are below. You can only measure through the tools. You never add a fact the tools or the earlier steps didn't return.

Before every tool call, put one plain sentence in the tool's "why" field saying what you need to know and why.

1. Read the review step. If it found a clear three, you may keep the calls without measuring anything; say so, citing the review step.
2. If it found no clear three, the first measurement did not separate the top names. You may run otherWay on the names you need to separate (the top group, or all of the candidates): it gives, for each, where that name's own fans rank the seed among their top 50, or that the seed is not in their top 50.
3. Then decide: keep, reorder, replace or drop calls, up to three, only from the candidates in the steps. Or call decline when the numbers support no call. Declining is an answer.

If the checker rejects your answer, its problems come back as the result of decide or decline. You get one more answer, and you may run otherWay once more first.

Writing: wrap every brand, artist or show name in double brackets, like [[Oreo]]. Use only numbers that appear in the steps you cite, with two decimals for scores. Name places and brands exactly as the steps give them; never group them into regions or describe what kind of brand they are. Say "sits closer to", never "prefers" or "wins". No percentages. Each reason and sentence is one short sentence and cites the step numbers it rests on. The earlier steps keep their numbers; your new steps continue after them.`;

const why = { why: { type: "string", description: "One plain sentence: what this step finds out and why you need it now." } } as const;
const obj = (props: Record<string, JSONSchema7>, required: string[]): JSONSchema7 => ({ type: "object", properties: props, required, additionalProperties: false });
const cited: JSONSchema7 = { type: "object", properties: { text: { type: "string" }, steps: { type: "array", items: { type: "integer" } } }, required: ["text", "steps"], additionalProperties: false };

type Get = (p: Record<string, string | number>) => Promise<Entity[]>;
type Seed = { name: string; id: string; type: string };

// The tools, pure over the frozen steps and a Qloo getter (tests run without the API). Same contract as tools.ts: names
// under "name", numbers as leaves, a method block, refusals as { error }.
export function lookTools(frozen: StepRecord[], get: Get, record: (s: StepRecord) => void) {
  const seed = frozen.find((s) => s.tool === "resolve")?.output as Seed | undefined;
  const cands = (frozen.find((s) => s.tool === "candidates")?.output as { candidates?: { name: string; id: string }[] } | undefined)?.candidates ?? [];
  const step = (tool: string, why: string, at: number, output: object, summary: string) => (record({ n: at, tool, why, output, summary }), output);
  return {
    otherWay: async ({ why, names }: { why: string; names: string[] }, at: number) => {
      if (!seed?.id) return step("otherWay", why, at, { error: "the ask has no confirmed seed" }, "No confirmed seed");
      const picked = names.map((n) => cands.find((c) => c.name === unbracket(n)));
      if (!names.length || picked.some((c) => !c)) return step("otherWay", why, at, { error: "otherWay only takes names from the candidates step" }, "Names not among the candidates");
      const rows = [];
      for (const c of picked as { name: string; id: string }[]) {
        const list = await get({ "filter.type": seed.type, "signal.interests.entities": c.id, take: 50 });
        const at = list.findIndex((e) => e.entity_id === seed.id) + 1;
        rows.push(at ? { name: c.name, seedRankAmongTheirFans: at } : { name: c.name, seedRankAmongTheirFans: "not in their top 50" });
      }
      const inTop = rows.filter((r) => typeof r.seedRankAmongTheirFans === "number").length;
      return step("otherWay", why, at, { method: { topN: 50 }, seed: { name: seed.name }, rows }, `${inTop} of ${rows.length} have ${seed.name} in their fans' top 50`);
    },
  };
}

// How the second look's answer relates to the frozen one, by code
export function outcomeOf(frozen: string[], final: { decision: Decision | null; check: Check }): Outcome {
  if (!final.check.ok || !final.decision) return "blocked";
  const now = final.decision.calls.map((c) => unbracket(c.name));
  if (!now.length) return "declined";
  return now.length === frozen.length && now.every((n, i) => n === frozen[i]) ? "kept" : "changed";
}

// scope "script": a replay case asked under the script-only family (Gate B); eight is that case's list
export type LookInput = { ask: AskInput; scope?: "script"; eight?: Candidate[] };
// events: the frozen ask's events (from peekAsk, or a script-only case ask); emits the new events only.
// model: injectable so the loop is tested with a scripted model (lib/ask/second.test.ts)
export async function runLook(events: AskEvent[], get: Get, emit: (e: LookEvent) => void, model: LanguageModel = anthropic(MODEL)): Promise<void> {
  const frozenSteps = stepsFrom(events);
  const d = decisionEvent(events);
  const frozenCalls = d?.decision?.calls.map((c) => unbracket(c.name)) ?? [];
  const steps = [...frozenSteps];
  let n = Math.max(0, ...frozenSteps.map((s) => s.n));
  const t = lookTools(frozenSteps, get, (s) => { steps.push(s); emit({ type: "result", n: s.n, summary: s.summary, output: s.output }); });
  let measures = 0, attempts = 0, done = false, measuredAfterNo = false;
  let final: { decision: Decision | null; check: Check } = { decision: null, check: { ok: false, problems: ["The second look stopped before deciding."] } };
  let rejected: Decision | null = null;

  const answer = (dec: Decision) => {
    attempts++;
    const check = checkDecision(dec, steps);
    final = { decision: dec, check };
    if (check.ok || attempts >= 2) return (done = true), "recorded";
    rejected = dec;
    emit({ type: "check", problems: check.problems });
    return { rejected: true, problems: check.problems, next: "One more decide or decline. You may run otherWay once more first." };
  };

  const facts = frozenSteps.map((s) => `Step ${s.n} (${s.tool}): ${s.summary}\n${JSON.stringify(s.output)}`).join("\n\n");
  const result = streamText({
    model,
    maxOutputTokens: 8000,
    providerOptions: { anthropic: { effort: "medium", fallbacks: "default", disableParallelToolUse: true } },
    stopWhen: [() => done, isStepCount(6)],
    instructions: { role: "system", content: SYSTEM, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    prompt: `The steps so far:\n\n${facts}\n\nThe decision on record${d?.check.ok ? "" : " (the checker blocked it)"}:\n${JSON.stringify(d?.decision ?? null)}\n\nTake the second look.`,
    tools: {
      otherWay: tool({
        description: "For candidate names, where each one's own fans rank the seed among their top 50 (or that it isn't there).",
        inputSchema: jsonSchema<{ why: string; names: string[] }>(obj({ ...why, names: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } } }, ["why", "names"])),
        execute: async (a) => {
          if (measures >= MAX_MEASURES) return { error: "no more measurements; decide or decline now" };
          measures++;
          if (rejected) measuredAfterNo = true;
          emit({ type: "call", n: ++n, tool: "otherWay", why: a.why });
          return t.otherWay(a, n);
        },
      }),
      decide: tool({
        description: "Your answer: calls (up to three), cautions and summary sentences, each citing step numbers.",
        inputSchema: jsonSchema<Decision>(obj({
          calls: { type: "array", maxItems: 3, items: obj({ name: { type: "string" }, reason: { type: "string" }, steps: { type: "array", items: { type: "integer" } } }, ["name", "reason", "steps"]) },
          cautions: { type: "array", items: cited }, summary: { type: "array", items: cited },
        }, ["calls", "cautions", "summary"])),
        execute: async (dec) => answer(dec),
      }),
      decline: tool({
        description: "Make no call, with one cited sentence saying which numbers stopped you.",
        inputSchema: jsonSchema<{ why: string; reason: { text: string; steps: number[] } }>(obj({ ...why, reason: cited }, ["why", "reason"])),
        execute: async ({ reason }) => answer({ calls: [], cautions: [], summary: [reason] }),
      }),
    },
  });
  for await (const part of result.stream) {
    if (part.type === "tool-error" || part.type === "error") throw (part as { error: unknown }).error;
  }
  emit({ type: "decision", ...final });
  // AGENT-4: a blocked answer that passes the second time with fewer names and numbers, and no new measurement between
  const citedLess = !!rejected && final.check.ok && !measuredAfterNo && !!final.decision && claimCount(final.decision) < claimCount(rejected);
  emit({ type: "look", outcome: outcomeOf(frozenCalls, final), frozen: frozenCalls, calls: final.decision?.calls.map((c) => unbracket(c.name)) ?? [], measured: measures > 0, checkFed: !!rejected, citedLess });
}

const keyOf = (i: LookInput) => `${i.scope ?? "live"}:${i.ask.id ? i.ask.id.toUpperCase() : (i.ask.query ?? "").trim().toLowerCase()}${i.ask.caseKey ? `#${i.ask.caseKey}` : ""}`;

// events: the frozen ask's, looked up by the caller (route: peekAsk; scripts: their own case cache)
export function makeLook(eventsOf: (i: LookInput) => Promise<AskEvent[] | null>) {
  const run = streamCache<LookInput, Streamed>("look", LOOK_VERSION, keyOf, async (i, say, write) => {
    const events = await eventsOf(i);
    if (!events) throw new Error("second look needs a cached ask");
    const trace: string[] = [];
    await runLook(events, insights as Get, (e) => { const s = JSON.stringify(e); trace.push(s); say(s); });
    const text = trace[trace.length - 1];
    write(text);
    return { text, trace };
  });
  const look = async (i: LookInput, ip: string, onEvent: (e: LookEvent) => void) => {
    const r = await run(i, ip, (s) => onEvent(JSON.parse(s)), () => {});
    const events: LookEvent[] = r.trace.map((s) => JSON.parse(s));
    if (!r.ran) for (const e of events) onEvent(e);
    return { ran: r.ran, events };
  };
  const peek = async (i: LookInput) => { const r = await run.peek(i); return r ? (r.trace.map((s) => JSON.parse(s)) as LookEvent[]) : null; };
  return { look, peek };
}

// the one instance: a live look reads the frozen ask from the live cache; a script look from the script-only family
export const secondLook = makeLook((i) => (i.scope === "script" && i.ask.caseKey && i.eight ? askCaseForScript({ ...i.ask, caseKey: i.ask.caseKey, eight: i.eight }, true) : peekAsk(i.ask)));
