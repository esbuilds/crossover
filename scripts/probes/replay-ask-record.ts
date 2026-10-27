// A one-off probe, run by hand and kept as the record of how its result was made; nothing in the app imports it.
// Record what the agent called on the one replay ask (from the cache, 0 Qloo calls) as derived numbers for /audit:
// the protocol's rank beside the agent's call, both shown, whatever the agent said.
//   node --env-file=.env.local scripts/probes/replay-ask-record.ts
import { writeFileSync } from "node:fs";
import { peekAsk } from "../../lib/ask/agent.ts";
import { REPLAY_ASK } from "../../lib/ask/prepared.ts";
import { unbracket } from "../../lib/ask/check.ts";
import replayV2 from "../../audit/replay-v2.json" with { type: "json" };

const events = await peekAsk({ ...REPLAY_ASK.body, caseKey: REPLAY_ASK.key });
if (!events) throw new Error("the replay ask isn't cached; run it first");
const d = events.findLast((e) => e.type === "decision");
if (!d || d.type !== "decision") throw new Error("no decision");
const c = replayV2.cases.find((x) => x.seed === REPLAY_ASK.seed && x.partner === REPLAY_ASK.partner)!;
const calls = d.decision?.calls.map((x) => unbracket(x.name)) ?? [];
const at = calls.indexOf(c.partnerMatched!);
const agentCall = !d.check.ok ? "blocked" : at < 0 ? (calls.length ? "not called" : "no clear three") : (["first", "second", "third"][at] ?? "not called");
const out = { case: `${REPLAY_ASK.seed} x ${REPLAY_ASK.partner}`, key: REPLAY_ASK.key, protocolRank: c.result!.rank, agentCall, calls, checkerPassed: d.check.ok, href: `/ask/${REPLAY_ASK.body.id}?t=${encodeURIComponent(REPLAY_ASK.body.type)}&case=${REPLAY_ASK.key}` };
writeFileSync("lib/ask/replay-ask.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out));
