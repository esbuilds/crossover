// The deal strip (SPECTACLE-1, moonshot round 2, real Oct 22): the 23 replayed deals as rows of eight slots ranked left
// to right, the real partner's slot filled. Built only from the audit files (through lib/replay-challenge.ts): 0 calls.
// Drawn by app/replay/strip/[size]/route.tsx for the gallery (1200 x 800) and Nov 5 (1920 x 1080).
import { CHALLENGE, PROTOCOL } from "./replay-challenge.ts";
import control from "../audit/replay-control.json" with { type: "json" };
import { replayLine } from "./replay-control.ts";

export type StripRow = { label: string; rank: number; slots: boolean[] }; // slots[i]: rank i + 1 is the real partner
export type StripBlock = { label: string; rows: StripRow[] };

// the case's own names, as /audit lists them (the key is test:seed:partner), not Qloo's matched names
const rowOf = (c: (typeof CHALLENGE)[number]): StripRow => ({ label: c.key.split(":").slice(1).join(" x "), rank: c.rank, slots: Array.from({ length: 8 }, (_, i) => i + 1 === c.rank) });

// The title is the /replay sentence, verbatim (app/replay/challenge.tsx); no new sentence on the picture
export const stripTitle = () => replayLine(control);

export function stripBlocks(): StripBlock[] {
  return [
    { label: `Second test, frozen before it ran: ${PROTOCOL.v2.hits} of ${PROTOCOL.v2.scored}`, rows: CHALLENGE.filter((c) => c.test === "v2").map(rowOf) },
    { label: `First test: ${PROTOCOL.v1.hits} of ${PROTOCOL.v1.scored}, missed its bar`, rows: CHALLENGE.filter((c) => c.test === "v1").map(rowOf) },
  ];
}
