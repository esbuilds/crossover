// The replay ask's eight (server only): the frozen v2 case's partner and seven decoys, as names and ids, sorted by name so
// the protocol's partner-first order can't give the answer away. No field marks the partner.
import replayV2 from "../../audit/replay-v2.json" with { type: "json" };
import { REPLAY_ASK } from "./prepared.ts";
import type { Candidate } from "./candidates.ts";

export function caseCandidates(key: string): Candidate[] | null {
  if (key !== REPLAY_ASK.key) return null;
  const c = replayV2.cases.find((x) => x.seed === REPLAY_ASK.seed && x.partner === REPLAY_ASK.partner && !x.dropped);
  if (!c?.decoys || !c.partnerId) return null;
  return [{ name: c.partnerMatched!, id: c.partnerId }, ...c.decoys.map((d) => ({ name: d.name, id: d.id }))].sort((a, b) => a.name.localeCompare(b.name));
}
