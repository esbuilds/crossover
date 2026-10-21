// The second look's gates (audit/second-look-protocol.md, AGENT-1). Run only after the protocol is committed.
//   node --env-file=.env.local scripts/second-look.ts list          0 calls: prints both gates' lists
//   node --env-file=.env.local scripts/second-look.ts gate-b        the 14 replay v2 cases (case asks under "ask-script")
//   node --env-file=.env.local scripts/second-look.ts gate-c        the cached seeds in audit/forks.json
// Writes audit/second-look.json (each gate's section), merging with what's there. Every ask and look is cached, so a
// re-run after a stop spends calls only on what didn't finish.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import replayV2 from "../audit/replay-v2.json" with { type: "json" };
import forks from "../audit/forks.json" with { type: "json" };
import { askCaseForScript, peekAsk, type AskEvent, type AskInput } from "../lib/ask/agent.ts";
import { REPLAY_ASK } from "../lib/ask/prepared.ts";
import { secondLook, type LookEvent, type LookInput } from "../lib/ask/second.ts";
import { decisionEvent, stepsFrom } from "../lib/ask/steps.ts";
import { qlooCallCount } from "../lib/qloo.ts";

const mode = process.argv[2];
const OUT = "audit/second-look.json";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const lastLook = (e: LookEvent[]) => e.findLast((x) => x.type === "look") as Extract<LookEvent, { type: "look" }>;

const cases = replayV2.cases.filter((c) => c.result?.state === "scored").map((c) => {
  const live = c.seed === REPLAY_ASK.seed && c.partner === REPLAY_ASK.partner;
  const eight = [{ name: c.partnerMatched!, id: c.partnerId! }, ...c.decoys!.map((d) => ({ name: d.name, id: d.id }))].sort((a, b) => a.name.localeCompare(b.name));
  const ask: AskInput = live ? { ...REPLAY_ASK.body, caseKey: REPLAY_ASK.key } : { id: c.seedId!, type: "urn:entity:brand", caseKey: `v2-${slug(c.seed)}-x-${slug(c.partner)}` };
  return { label: `${c.seed} x ${c.partner}`, partner: c.partnerMatched!, rank: c.result!.rank!, live, eight, ask };
});

if (mode === "list") {
  console.log(`Gate B, ${cases.length} cases:`);
  for (const c of cases) console.log(`  ${c.label} (protocol rank ${c.rank}; ${c.live ? "live case ask, cached" : `script case ask ${c.ask.caseKey}`})`);
  console.log(`Gate C, ${forks.seeds.length} seeds: ${forks.seeds.map((s) => s.name).join(", ")}`);
  process.exit(0);
}

const prior = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const rows: Record<string, unknown>[] = [];
const runLook = async (input: LookInput) => (await secondLook.look(input, "warm", () => {})).events;

if (mode === "gate-b") {
  for (const c of cases) {
    const frozen: AskEvent[] | null = c.live ? await peekAsk(c.ask) : await askCaseForScript({ ...c.ask, caseKey: c.ask.caseKey!, eight: c.eight });
    if (!frozen) throw new Error(`no case ask for ${c.label}`);
    const fd = decisionEvent(frozen);
    const events = await runLook(c.live ? { ask: c.ask } : { ask: c.ask, scope: "script", eight: c.eight });
    const l = lastLook(events);
    // reported, not gated: the other direction for the real partner and the decoys, where the look measured it
    const other = stepsFrom(events as AskEvent[]).filter((s) => s.tool === "otherWay").flatMap((s) => (s.output as { rows?: { name: string; seedRankAmongTheirFans: number | string }[] }).rows ?? []);
    const row = {
      case: c.label, protocolRank: c.rank, frozenCalls: fd?.decision?.calls.map((x) => x.name.replace(/\[\[|\]\]/g, "")) ?? [], frozenChecked: !!fd?.check.ok,
      ...l, partnerKept: l.calls.includes(c.partner), partnerOtherWay: other.find((r) => r.name === c.partner)?.seedRankAmongTheirFans ?? null, otherWay: other,
    };
    rows.push(row);
    console.log(`${c.label} (rank ${c.rank}): ${l.outcome}; calls ${l.calls.join(", ") || "none"}; partner ${row.partnerKept ? "kept" : "not kept"}${l.measured ? `; partner's fans rank the seed ${row.partnerOtherWay ?? "unmeasured"}` : ""}`);
  }
  const kept = rows.filter((r) => r.partnerKept).length;
  const declinedRankOne = rows.filter((r) => r.protocolRank === 1 && r.outcome === "declined").length;
  const summary = { cases: rows.length, partnerKept: kept, declinedRankOne, blocked: rows.filter((r) => r.outcome === "blocked").length, citedLess: rows.filter((r) => r.citedLess).length, pass: kept >= 11 && declinedRankOne === 0 };
  console.log(`\nGate B: partner kept ${kept} of ${rows.length} (need 11), rank-1 cases declined ${declinedRankOne} (need 0): ${summary.pass ? "PASS" : "FAIL"}`);
  prior.gateB = { ranAt: new Date().toISOString().slice(0, 10), summary, cases: rows };
} else if (mode === "gate-c") {
  for (const s of forks.seeds) {
    const events = await runLook({ ask: s.body as AskInput });
    const l = lastLook(events);
    rows.push({ seed: s.name, ...l });
    console.log(`${s.name}: ${l.outcome}; calls ${l.calls.join(", ") || "none"}${l.checkFed ? "; checker fed back" : ""}${l.citedLess ? "; cited less" : ""}`);
  }
  const checked = rows.filter((r) => r.outcome !== "blocked").length;
  const need = Math.ceil((18 / 22) * rows.length);
  const by = (o: string) => rows.filter((r) => r.outcome === o).length;
  const summary = { seeds: rows.length, checked, need, kept: by("kept"), changed: by("changed"), declined: by("declined"), blocked: by("blocked"), measured: rows.filter((r) => r.measured).length, checkFed: rows.filter((r) => r.checkFed).length, citedLess: rows.filter((r) => r.citedLess).length, pass: checked >= need };
  console.log(`\nGate C: checked ${checked} of ${rows.length} (need ${need}): ${summary.pass ? "PASS" : "FAIL"} (hashes are checked separately)`);
  prior.gateC = { ranAt: new Date().toISOString().slice(0, 10), summary, seeds: rows };
} else throw new Error("mode: list | gate-b | gate-c");

writeFileSync(OUT, JSON.stringify({ protocol: "audit/second-look-protocol.md", ...prior }, null, 2) + "\n");
console.log(`Qloo calls: ${qlooCallCount()}`);
process.exit(0);
