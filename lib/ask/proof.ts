// The replay line under the ask's decision and on the call sheet, from the two frozen tests' published summaries.
// Server only: the replay files stay out of the client bundle.
import replay from "../../audit/replay.json" with { type: "json" };
import replayV2 from "../../audit/replay-v2.json" with { type: "json" };
import { replayLine } from "./steps.ts";

export const PROOF = replayLine(replay.summary!, replayV2.summary!);
