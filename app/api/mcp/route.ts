// app/api/mcp/route.ts
// Crossover over MCP (moonshots round 4, real Oct 18): any MCP client can read a checked answer and re-check it.
// Cache only: peekAsk never calls Qloo or the model, so the 600-a-day cap and the 20-per-IP limit can't be spent here.
// ponytail: no auth, read-only over published answers; add withMcpAuth if a write or live tool ever lands.
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { peekAsk } from "@/lib/ask/agent.ts";
import { parseAskBody } from "@/lib/ask/body.ts";
import { decisionEvent, stepsFrom } from "@/lib/ask/steps.ts";
import { CHECK_RULE, checkDecision, type Decision, type StepRecord } from "@/lib/ask/check.ts";

const SITE = "https://crossover-henna.vercel.app";

// Prepared and linked asks are cached by Qloo id, not by the typed name, so a name maps to its id through the confirmed
// resolve step of every cached ask. One SCAN per instance, still 0 Qloo calls.
// ponytail: rebuilt only on a cold instance; asks made after that are found by their typed name until the next one.
let index: Promise<Map<string, { id: string; type: string }>> | null = null;
const redis = async (commands: (string | number)[][]) =>
  ((await (await fetch(`${process.env.KV_REST_API_URL}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(commands) })).json()) as { result?: unknown }[]).map((r) => r.result);
async function buildIndex() {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [[next, batch]] = (await redis([["SCAN", cursor, "MATCH", "cx:ask:*", "COUNT", 1000]])) as [string, string[]][];
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");
  const out = new Map<string, { id: string; type: string }>();
  const raws = keys.length ? ((await redis(keys.map((k) => ["GET", k]))) as (string | null)[]) : [];
  for (const raw of raws) {
    for (const s of (raw ? (JSON.parse(raw) as { trace?: string[] }).trace ?? [] : [])) {
      const e = JSON.parse(s) as { type: string; output?: { state?: string; name?: string; id?: string; type?: string } };
      if (e.type === "result" && e.output?.state === "confirmed" && e.output.name && e.output.id && e.output.type) out.set(e.output.name.toLowerCase(), { id: e.output.id, type: e.output.type });
    }
  }
  return out;
}
async function cachedEvents(name: string) {
  const byName = parseAskBody({ query: name });
  const typed = byName && (await peekAsk(byName));
  if (typed) return typed;
  const hit = (await (index ??= buildIndex())).get(name.trim().toLowerCase());
  return hit ? peekAsk(hit) : null;
}
const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const stepSchema = z.object({ n: z.number(), tool: z.string(), why: z.string(), output: z.unknown(), summary: z.string() });
const cited = z.object({ text: z.string(), steps: z.array(z.number()) });

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "crossover_ask",
      {
        title: "Who should this brand call first?",
        description: "Crossover's checked answer for a brand, artist or show, from its published cache: the agent's calls, every Qloo step it cited, and the checker's verdict under the current rule. Never runs a new ask; uncached names get a link to ask on the site.",
        inputSchema: z.object({ name: z.string().min(1).max(100) }),
      },
      async ({ name }) => {
        const events = await cachedEvents(name);
        if (!events) return text(`Crossover hasn't answered "${name}" yet. Type it at ${SITE} (about 40 seconds), then call this again.`);
        const d = decisionEvent(events);
        return text({ rule: CHECK_RULE, decision: d?.decision ?? null, check: d?.check ?? null, steps: stepsFrom(events) });
      },
    );
    server.registerTool(
      "crossover_check",
      {
        title: "Check an answer against its steps",
        description: "Run Crossover's checker on a decision and the steps it cites: every name and number must appear in a cited step, and a score or rank right after a brand must be that brand's own. Pure code, no calls. Edit a number from crossover_ask and see it rejected.",
        inputSchema: z.object({
          decision: z.object({ calls: z.array(z.object({ name: z.string(), reason: z.string(), steps: z.array(z.number()) })), cautions: z.array(cited), summary: z.array(cited) }),
          steps: z.array(stepSchema),
        }),
      },
      async ({ decision, steps }) => text({ rule: CHECK_RULE, ...checkDecision(decision as Decision, steps as StepRecord[]) }),
    );
  },
  { serverInfo: { name: "crossover", version: "1.0.0" } },
);

export { handler as GET, handler as POST };
