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

// A browser at /api/mcp (the README and the Devpost print the URL) used to get mcp-handler's raw 405 JSON. Stateless
// Streamable HTTP has no GET stream, so a GET that isn't asking for one (no text/event-stream in Accept) gets a page
// that says what the server is, in the site's own type, or the same as JSON for curl. MCP clients only ever POST here.
const TOOLS = [
  { name: "crossover_ask", input: "{ name }", line: "A cached, checked answer for a brand, artist or show: the agent's calls, every Qloo step it cited, and the checker's verdict under the current rule. Never runs a new ask; an uncached name gets a link to ask on the site." },
  { name: "crossover_check", input: "{ decision, steps }", line: "The checker on any decision and the steps it cites: every name and number must appear in a cited step, and a score or rank right after a brand must be that brand's own. Pure code. Edit a number from crossover_ask and see it rejected." },
];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function aboutPage(url: string) {
  const css = `
    :root{--ink:#1b1716;--ink-2:#514c49;--ink-3:#6b6562;--rule:#e0dddc;--rule-strong:#c9c4c2;--surface-2:#f8f7f7}
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased}
    main{max-width:1120px;margin:0 auto;padding:0 16px 96px}
    @media(min-width:640px){main{padding:0 32px 96px}}
    header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--rule);padding:12px 0}
    .serif{font-family:Newsreader,Georgia,"Times New Roman",serif;font-weight:600}
    header a{color:var(--ink);text-decoration:none;font-size:1.375rem}
    header nav a{font-size:.875rem;color:var(--ink-2);margin-left:16px}
    h1{font-size:1.75rem;line-height:2.1rem;margin:48px 0 0}
    @media(min-width:640px){h1{font-size:2.25rem;line-height:2.6rem}}
    p{max-width:68ch;color:var(--ink-2);margin:8px 0 0}
    code,pre{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:.875rem}
    pre{margin:12px 0 0;padding:12px 16px;background:var(--surface-2);border-radius:8px;overflow-x:auto;white-space:pre}
    .url{display:inline-block;margin-top:16px;padding:8px 12px;border:1px solid var(--rule-strong);border-radius:8px;color:var(--ink);font-size:1rem;word-break:break-all}
    h2{font-size:1.375rem;line-height:1.75rem;margin:40px 0 0}
    dl{margin:16px 0 0;padding:0}
    dt{margin-top:16px;color:var(--ink);font-weight:500}
    dt span{color:var(--ink-3);font-weight:400;margin-left:8px}
    dd{margin:4px 0 0;max-width:68ch;color:var(--ink-2)}
    a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--ink-3);text-underline-offset:4px}
    footer{margin-top:64px;border-top:1px solid var(--rule);padding-top:24px;font-size:.875rem;color:var(--ink-3)}
    footer .serif{color:var(--ink);font-size:1rem}`;
  const tools = TOOLS.map((t) => `<dt><code>${t.name}</code><span>${esc(t.input)}</span></dt><dd>${esc(t.line)}</dd>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crossover over MCP | Crossover</title><meta name="robots" content="noindex"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:wght@600&display=swap"><style>${css}</style></head><body><main>
<header><a class="serif" href="/">Crossover</a><nav><a href="/">Ask</a><a href="/vs">Two names in</a><a href="/replay">Real deals</a><a href="/audit">The audit</a></nav></header>
<h1 class="serif">Crossover over MCP</h1>
<p>Any MCP client can read one of Crossover's checked answers and run the checker on it. Streamable HTTP, no auth, read-only over the published cache: it never spends a Qloo call and never runs the model.</p>
<code class="url">${esc(url)}</code>
<h2 class="serif">Two tools</h2>
<dl>${tools}</dl>
<h2 class="serif">Connect</h2>
<p>Claude Code, one line:</p>
<pre>claude mcp add --transport http crossover ${esc(url)}</pre>
<p>Any other client: add it as a remote MCP server at that URL (Streamable HTTP, POST only). Then ask it who Allbirds should call first, change a number in the answer, and ask it to check that.</p>
<p>The round-trip test in the repo: <code>node scripts/mcp-gate.ts ${esc(url)}</code> lists the tools, reads a cached answer, and shows the checker rejecting a tampered copy.</p>
<footer><span class="serif">Crossover</span> · Data: Qloo, built on its taste graph · <a href="/audit#api-notes">Notes on the API</a></footer>
</main></body></html>`;
}
async function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream")) return handler(request);
  const url = new URL(request.url);
  const self = `${url.hostname === "localhost" || url.hostname === "127.0.0.1" ? url.origin : SITE}/api/mcp`;
  if (accept.includes("text/html")) return new Response(aboutPage(self), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  return Response.json({ name: "crossover", version: "1.0.0", transport: "streamable-http", endpoint: self, tools: TOOLS.map((t) => ({ name: t.name, input: t.input, description: t.line })), note: "POST JSON-RPC here. Read-only over the published cache: no Qloo or model calls." });
}

export { GET, handler as POST };
