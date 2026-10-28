// MCP gate: a stock MCP client lists the tools, reads a cached answer, and the checker
// rejects a tampered copy of it. 0 Qloo, 0 model calls.
//   node scripts/mcp-gate.ts [url]   (default http://localhost:3000/api/mcp)
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = new URL(process.argv[2] ?? "http://localhost:3000/api/mcp");
const client = new Client({ name: "mcp-gate", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(url));
const body = (r: { content: unknown }) => (r.content as { type: string; text: string }[])[0].text;

const tools = (await client.listTools()).tools.map((t) => t.name);
console.log("tools:", tools.join(", "));

const answer = JSON.parse(body(await client.callTool({ name: "crossover_ask", arguments: { name: "Allbirds" } })));
console.log("ask Allbirds:", answer.decision?.calls?.[0]?.name, "| check", JSON.stringify(answer.check), "| rule", answer.rule, "|", answer.steps.length, "steps");

const as = (d: unknown) => client.callTool({ name: "crossover_check", arguments: { decision: d, steps: answer.steps } }).then((r) => JSON.parse(body(r)));
const untouched = await as(answer.decision);
const tampered = structuredClone(answer.decision);
tampered.calls[0].reason = tampered.calls[0].reason.replace(/\d+\.\d+/, (x: string) => (Number(x) + 0.03).toFixed(2));
const caught = await as(tampered);
console.log("re-check untouched:", JSON.stringify(untouched));
console.log("re-check tampered:", JSON.stringify(caught));
console.log("uncached:", body(await client.callTool({ name: "crossover_ask", arguments: { name: "zzqx not a brand" } })));
const pass = tools.includes("crossover_ask") && tools.includes("crossover_check") && answer.check?.ok && untouched.ok && !caught.ok;
console.log(`GATE ${pass ? "PASS" : "FAIL"}`);
await client.close();
