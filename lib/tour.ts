// The 60-second judge tour (a fourth stop, the replay challenge, since Oct 15): stops on pages that already exist, a slim bar
// with "n of 3" and Next. Client-safe. The numbers in the lines are the published ones (replay v1 and v2, the e.l.f.
// sell-out); the frozen answers supply the rest on the pages themselves.
import { REPLAY_ASK } from "./ask/prepared.ts";

// The replay control's summary (audit/replay-control.json), copied so the 15 KB file stays out of the client bundle;
// lib/tour.test.ts fails if these drift from the file.
export const CONTROL = { cases: 23, realHits: 17, scrambledHits: 17 };

export const TOUR = [
  { path: "/", line: "One name in. The agent measured Allbirds in Qloo, step by step, and calls Bombas first; every name and number in its answer is checked against the step it cites." },
  { path: `/ask/${REPLAY_ASK.body.id}`, line: `A real deal, replayed blind: given Coca-Cola and eight brands without knowing which was real, the agent called Converse first. Across ${CONTROL.cases} real deals, the real partner made the top three ${CONTROL.realHits} times, and ${CONTROL.scrambledHits} times again with the wrong seed brand swapped in, so the replay measures how the candidate lists were built.` },
  { path: "/audit", line: "Where taste doesn't decide: Liquid Death x e.l.f. sold out in 45 minutes with weaker measured taste. Every test on this page was frozen in git before it ran." },
  // the replay challenge, guess then reveal
  { path: "/replay", line: "Your turn: 23 real collaborations, each hidden among seven decoys. Pick the real partner, then see where the seed's fans put it." },
];

export function tourHref(n: number): string {
  if (n === 1) return "/?tour=1";
  if (n === 2) return `/ask/${REPLAY_ASK.body.id}?${new URLSearchParams({ t: REPLAY_ASK.body.type, case: REPLAY_ASK.key, tour: "2" })}`;
  if (n === 3) return "/audit?tour=3#counterexample";
  if (n === 4) return "/replay?tour=4";
  return "/";
}
