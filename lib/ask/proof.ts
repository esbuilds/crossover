// The line under every answer and on the call sheet: the checker's attacked count from the published mutation gate
// (PROOF-LINE, real Oct 22). Server only: the audit files stay out of the client bundle.
import mutation from "../../audit/mutation.json" with { type: "json" };
import { checkerLine } from "./steps.ts";

export const PROOF = checkerLine(mutation.gated);
// the same count in a few words, for the ask page's one proof line (W3, real Oct 25)
export const CAUGHT = `${mutation.gated.rejected} of ${mutation.gated.of} altered answers caught`;
