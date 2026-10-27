// A one-off probe, run by hand and kept as the record of how its result was made; nothing in the app imports it.
// Warm the X-ray (lib/rivals.ts XRAY_TYPES) for every prepared pair: the page reads it from the cache only.
// About 24 calls per cold pair, serial; warm pairs cost nothing.
//   QLOO_DAILY_CAP=<n> node --env-file=.env.local scripts/probes/xray-warm.ts
import { insights, qlooCallCount, type Entity } from "../../lib/qloo.ts";
import { getRivals, XRAY_TYPES } from "../../lib/rivals.ts";
import { VS_CASES, VS_MORE } from "../../lib/rivals-cases.ts";

for (const c of [...VS_CASES, ...VS_MORE]) {
  const card = async (s: { id: string; type: string }) => ((await insights({ "filter.type": s.type, "filter.results.entities": s.id, take: 1 }))[0] as Entity | undefined);
  const [a, b] = [await card(c.a), await card(c.b)];
  if (!a || !b) { console.log(`${c.a.name} vs ${c.b.name}: no card`); continue; }
  const before = qlooCallCount();
  const got = [];
  for (const t of XRAY_TYPES) {
    const r = await getRivals({ ...a, types: [c.a.type] }, { ...b, types: [c.b.type] }, false, t).catch((e) => String(e).slice(0, 80));
    got.push(`${t.replace("urn:entity:", "")} ${typeof r === "string" ? `FAILED ${r}` : `${r?.leansA.length}/${r?.leansB.length}/${r?.shared.length}`}`);
  }
  console.log(`${c.a.name} vs ${c.b.name}: ${got.join(", ")} (${qlooCallCount() - before} calls)`);
}
