// The prepared asks on the front door (server-free: the home page replays the first from the cache on the server, and
// the client draws the chips). Allbirds first since the hero ruling (real Oct 14): it has a rival, so its split map is
// the picture above the fold; Mt. Joy second (no rival, so its picture is the dumbbell).
export const PREPARED_ASKS: { label: string; body: { id: string; type: string } }[] = [
  { label: "Allbirds", body: { id: "78A44C09-E691-42DA-A553-5CDE6EE9B18A", type: "urn:entity:brand" } },
  { label: "Mt. Joy", body: { id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: "urn:entity:artist" } },
];
