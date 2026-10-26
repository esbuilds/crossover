// scripts/pitch-warm.ts
// The pitch sheet's "Where to pitch it" (W2, real Oct 24): the sheet reads venues from the cache only, so warm the
// Mt. Joy x Allbirds venues in Mt. Joy's lead market once (3 place calls; the Allbirds x Bombas venues are the call
// sheet's own, already cached). venuesIn live: whereToStart's peek can't warm it, since venuesIn turns a cold list into
// an empty one. Prints production's /api/usage before and after. Run once:
//   node --env-file=.env.local scripts/pitch-warm.ts https://crossover-henna.vercel.app
import { readFileSync } from "node:fs";
import { whereToStart } from "../lib/ask/where.ts";
import { venueLine, venuesIn } from "../lib/ask/venues.ts";
import type { AskEvent } from "../lib/ask/agent.ts";
// read, not imported: the recorded asks are Qloo data and stay out of the public repo (W2, real Oct 25)
const mtJoy = JSON.parse(readFileSync(new URL("../lib/ask/fixtures/mt-joy.json", import.meta.url), "utf8"));

const base = process.argv[2];
if (!base) throw new Error("usage: scripts/pitch-warm.ts <baseUrl>");
const usage = async () => (await (await fetch(`${base}/api/usage`)).json()).today as number;
const before = await usage();
const events = mtJoy as unknown as AskEvent[];
const market = (await whereToStart(events, null, "Allbirds"))?.market; // the lead market, from the cache
const pick = (events.find((e) => (e as { output?: { candidates?: unknown } }).output?.candidates) as unknown as { output: { candidates: { name: string; id: string }[] } }).output.candidates.find((c) => c.name === "Allbirds")!;
if (!market) throw new Error("no cached lead market for Mt. Joy");
const venues = await venuesIn({ seedId: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", pickId: pick.id, market, artist: true });
console.log(`Mt. Joy x Allbirds in ${market}: ${venueLine(market, "Mt. Joy", "Allbirds", venues) ?? `${venues.length} venues, no line`}`);
console.log(`/api/usage today ${before} -> ${await usage()}`);
