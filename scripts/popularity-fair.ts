// Writes audit/popularity-fair.json from the frozen replay files (lib/popularity-fair.ts). 0 Qloo calls.
//   node scripts/popularity-fair.ts
import { writeFileSync } from "node:fs";
import { popularityFair } from "../lib/popularity-fair.ts";

const out = popularityFair();
const note = "Re-analysis of numbers already in audit/replay.json and audit/replay-v2.json, not a pre-registered test. The popularityRank field stored there sorts the real partner first among equal popularities, so it favors the partner and is not a result; expectedTopThree breaks those ties at random.";
writeFileSync("audit/popularity-fair.json", JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), note, ...out }, null, 2) + "\n");
console.log(`popularity alone, fair ties: about ${out.expectedTopThree} of ${out.scored} in the top three (stored field: ${out.storedTopThree}; fans' scores: ${out.affinityTopThree})`);
