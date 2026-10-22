// The prepared asks on the front door (server-free: the home page replays the first from the cache on the server, and
// the client draws the chips). Allbirds first since the hero ruling (real Oct 14): it has a rival, so its split map is
// the picture above the fold; Mt. Joy second (no rival, so its picture is the dumbbell).
export const PREPARED_ASKS: { label: string; body: { id: string; type: string } }[] = [
  { label: "Allbirds", body: { id: "78A44C09-E691-42DA-A553-5CDE6EE9B18A", type: "urn:entity:brand" } },
  // "An artist", not "An artist's tour sponsor" (COLDJUDGE-4, real Oct 22): the list is brands its fans favor, not sponsors
  { label: "An artist: Mt. Joy", body: { id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: "urn:entity:artist" } },
  // a third world (HARSH-10, DES-5, real Oct 23): both chips above land on one apparel cluster. Calm was already cached
  // under ask-v1.6+t2, passes check rule v3.1, and its rival (Headspace) gives the card a split map; 0 calls to add
  { label: "An app: Calm", body: { id: "47DD40B2-E2BC-421A-9466-C229D9DFDA09", type: "urn:entity:brand" } },
];

// A share link whose ask isn't cached and whose name the cache doesn't know either (FIX-F7): the chip says this and the
// input stays empty.
export const UNNAMED_ASK = "This link's ask";

// The one replay case run as an ask (Pick 2, real Oct 14), named before it ran: a v2 rank-1 case a judge can place. A
// demonstration for the video, not a test; prepared only (a visitor can't type a case).
export const REPLAY_ASK = { key: "coca-cola-x-converse", label: "Coca-Cola x Converse", seed: "Coca-Cola", partner: "Converse", body: { id: "A539C8C9-4733-41A9-911A-11AC2B6D475A", type: "urn:entity:brand" } };
