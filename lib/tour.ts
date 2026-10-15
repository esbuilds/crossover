// The 60-second judge tour (Eric's features push, real Oct 14; a fourth stop, the replay challenge, Oct 15): stops on pages that already exist, a slim bar
// with "n of 3" and Next. Client-safe. The numbers in the lines are the published ones (replay v1 and v2, the e.l.f.
// sell-out); the frozen answers supply the rest on the pages themselves.
import { REPLAY_ASK } from "./ask/prepared.ts";

export const TOUR = [
  { path: "/", line: "One name in. The agent measured Allbirds in Qloo, step by step, and calls Bombas first; every name and number in its answer is checked against the step it cites." },
  { path: `/ask/${REPLAY_ASK.body.id}`, line: "A real deal, replayed blind: given Coca-Cola and eight brands without knowing which was real, the agent called Converse first. Across 14 frozen cases, 11 real partners landed in the top three (the first test, 6 of 9, missed its bar)." },
  { path: "/audit", line: "Where taste doesn't decide: Liquid Death x e.l.f. sold out in 45 minutes with weaker measured taste. Every test on this page was frozen in git before it ran." },
  // Fable's re-judge ruling (Oct 15): the replay challenge, guess then reveal
  { path: "/replay", line: "Your turn: 23 real collaborations, each hidden among seven decoys. Pick the real partner, then see where the seed's fans put it." },
];

export function tourHref(n: number): string {
  if (n === 1) return "/?tour=1";
  if (n === 2) return `/ask/${REPLAY_ASK.body.id}?${new URLSearchParams({ t: REPLAY_ASK.body.type, case: REPLAY_ASK.key, tour: "2" })}`;
  if (n === 3) return "/audit?tour=3#counterexample";
  if (n === 4) return "/replay?tour=4";
  return "/";
}
