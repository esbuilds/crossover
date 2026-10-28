// the real audit tables are Qloo data, which Qloo's hackathon guide keeps out of public repos, so the
// public mirror builds on the stand-ins in audit/demo/ (scripts/demo-audit.ts), moved over audit/<file>.json and marked
// "demo": true. Production never carries the mark. Pages that read these tables print the notice when it's there.
import results from "../audit/results.json" with { type: "json" };
import replay from "../audit/replay.json" with { type: "json" };
import replayV2 from "../audit/replay-v2.json" with { type: "json" };
import control from "../audit/replay-control.json" with { type: "json" };
import reverse from "../audit/replay-reverse.json" with { type: "json" };
import fair from "../audit/popularity-fair.json" with { type: "json" };

export const isDemoAudit = () => [results, replay, replayV2, control, reverse, fair].some((f) => "demo" in f);

export const DEMO_AUDIT_NOTICE = "Demo data. This copy runs on made-up audit tables, because the real ones are Qloo data and stay private. The live site shows the real tables, and the README says how to rebuild them with a Qloo key.";
export const DEMO_REPLAY_NOTICE = "Demo data. This copy runs on made-up deals and scores, because the real ones are Qloo data and stay private. The live site has the real game.";
