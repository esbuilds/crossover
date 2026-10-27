// A one-off probe, run by hand and kept as the record of how its result was made; nothing in the app imports it.
// Replay v3 exclusion d (audit/replay-v3-protocol.md): does each seed and partner confirm under the v1 identity rule?
// Same search + resolve + identityOf as scripts/replay-build.ts's confirm(), without the card call; 1 Qloo call per name, cached.
//   QLOO_DAILY_CAP=<n> node --env-file=.env.local scripts/probes/replay-resolve.ts audit/replay-v3-cases.json
import { readFileSync } from "node:fs";
import { search, qlooCallCount, type Entity } from "../../lib/qloo.ts";
import { resolve } from "../../lib/resolve.ts";
import { identityOf } from "../../lib/review.ts";

const cases: { seed: string; partner: string }[] = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const c of cases) {
  const row = [];
  for (const name of [c.seed, c.partner]) {
    const id = identityOf(name, await resolve(name, (await search(name, ["urn:entity:brand"], 5)) as Entity[]));
    row.push(id.state === "confirmed" ? `${name} = ${id.entity.name}` : `${name}: ${id.state}${id.state === "ambiguous" ? ` (${id.options.map((o) => o.name).join(" / ")})` : ""}`);
  }
  console.log(`${c.seed} x ${c.partner} | ${row.join(" | ")}`);
}
console.log(`Qloo calls: ${qlooCallCount()}`);
