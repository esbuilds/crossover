// The replay line under the ask's decision and on the call sheet, from the published replay control's summary.
// Server only: the replay files stay out of the client bundle.
import control from "../../audit/replay-control.json" with { type: "json" };
import { replayLine } from "./steps.ts";

export const PROOF = replayLine(control.summary);
