import type { Asked } from "./links.ts";

// The prepared asks on the front door (server-free: the home page replays the first from the cache on the server, and
// the client draws the chips). Allbirds first: it has a rival, so its split map is
// the picture above the fold; Mt. Joy second (no rival, so its picture is the dumbbell).
export const PREPARED_ASKS: { label: string; body: { id: string; type: string } }[] = [
  { label: "Allbirds", body: { id: "78A44C09-E691-42DA-A553-5CDE6EE9B18A", type: "urn:entity:brand" } },
  // "An artist", not "An artist's tour sponsor": the list is brands its fans favor, not sponsors
  { label: "An artist: Mt. Joy", body: { id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: "urn:entity:artist" } },
  // a third world: both chips above land on one apparel cluster. Calm was already cached
  // under ask-v1.6+t2, passes check rule v3.1, and its rival (Headspace) gives the card a split map; 0 calls to add
  { label: "An app: Calm", body: { id: "47DD40B2-E2BC-421A-9466-C229D9DFDA09", type: "urn:entity:brand" } },
];

// A share link whose ask isn't cached and whose name the cache doesn't know either: the chip says this and the
// input stays empty.
export const UNNAMED_ASK = "This link's ask";

// The one replay case run as an ask, named before it ran: a v2 rank-1 case a judge can place. A
// demonstration for the video, not a test; prepared only (a visitor can't type a case).
export const REPLAY_ASK = { key: "coca-cola-x-converse", label: "Coca-Cola x Converse", seed: "Coca-Cola", partner: "Converse", body: { id: "A539C8C9-4733-41A9-911A-11AC2B6D475A", type: "urn:entity:brand" } };

// "Already answered, no wait": household names whose answer the cache already holds, as plain links
// under the chips. asked is the cache key (a typed name, the replay case, or the id); seed is the name step 1 confirmed.
// Each page serves its answer from the cache: a GET of each on production read /api/usage before and after, 0 new calls.
// Noah Kahan's cached answer was blocked by the checker, so it isn't "answered"; Cedric the Entertainer stays on /audit.
// Six, not twelve. Typed exactly so, Chipotle, Oatly, Sweetgreen, Dove and Olipop still answer from
// the cache (the typed key is case-sensitive); Dr. Squatch was asked by id, so typing it runs live.
const BRAND = "urn:entity:brand", ARTIST = "urn:entity:artist";
const byId = (id: string, type = BRAND) => ({ asked: { id, type }, seed: { id, type } });
const typed = (query: string, id: string, type = BRAND) => ({ asked: { query }, seed: { id, type } });
export const ANSWERED: { label: string; asked: Asked; seed: { id: string; type: string } }[] = [
  { label: "Coca-Cola (x Converse)", asked: { case: REPLAY_ASK.key }, seed: REPLAY_ASK.body },
  { label: "Taylor Swift", ...typed("Taylor Swift", "4BBEF799-A0C4-4110-AB01-39216993C312", ARTIST) },
  { label: "Patagonia", ...byId("DB4CE34E-3A63-4947-946F-9D52502C5762") },
  { label: "YETI", ...byId("AA9DBB9A-DEE1-4D84-BC26-0FEBB34BB41B") },
  { label: "Tyler Childers", ...typed("Tyler Childers", "9B5028F6-5808-4BF4-A623-24C6C148D24B", ARTIST) },
  { label: "Los Angeles Dodgers", ...typed("Los Angeles Dodgers", "9B8B279C-B777-4293-8121-B8174970B57D") },
];
