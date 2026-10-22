// scripts/ask-warm.ts
// Warm the prepared asks through the deployed app (WARM_TOKEN skips the per-IP limit; the Qloo daily cap still applies).
//   WARM_TOKEN=... node scripts/ask-warm.ts https://crossover-henna.vercel.app
const base = process.argv[2];
if (!base) throw new Error("usage: scripts/ask-warm.ts <baseUrl>");
const ASKS = [
  // the prepared chips (lib/ask/prepared.ts), then Liquid Death's (cached, unlinked)
  { id: "78A44C09-E691-42DA-A553-5CDE6EE9B18A", type: "urn:entity:brand", label: "Allbirds" },
  { id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: "urn:entity:artist", label: "Mt. Joy" },
  { id: "47DD40B2-E2BC-421A-9466-C229D9DFDA09", type: "urn:entity:brand", label: "Calm" },
  { id: "4DF7C265-52D9-4A99-8803-F62C2302D561", type: "urn:entity:brand", label: "Liquid Death" },
];
for (const a of ASKS) {
  const before = (await (await fetch(`${base}/api/usage`)).json()).today;
  const res = await fetch(`${base}/api/ask`, { method: "POST", headers: { "content-type": "application/json", "x-warm-token": process.env.WARM_TOKEN ?? "" }, body: JSON.stringify({ id: a.id, type: a.type }) });
  const text = await res.text();
  const check = /"check":(\{[^}]*\})/.exec(text)?.[1] ?? "none";
  const done = /"type":"done","cached":(true|false)/.exec(text)?.[1] ?? "no done";
  console.log(`${a.label}: check ${check}, cached ${done}, ${(await (await fetch(`${base}/api/usage`)).json()).today - before} Qloo calls`);
}
export {}; // a module, for top-level await
