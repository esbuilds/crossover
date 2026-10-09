// Re-warm the cache through the deployed app, one entity at a time (Oct 22). Per entity: resolve, the full run
// (ranking, badges, trends), then the top brand's brief and its age breakdown. Serial on purpose: never parallel
// against live APIs. It reads /api/usage before every step, stops before the shared daily cap, logs Qloo calls per
// entity, and is restartable: finished entities are recorded in the state file and skipped, and everything it
// already warmed is a free cache hit anyway.
//
//   node scripts/warm.ts <baseUrl> <list.json> [--reserve 40] [--state scripts/warm-state.json] [--no-cohort]
//   list.json: [{ "name": "Liquid Death", "type": "urn:entity:brand" }, ...]
//   WARM_TOKEN in the environment (same value as on Vercel) keeps briefs off the per-IP limit of 20 a day.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

type Item = { name: string; type: string };
type Done = Record<string, { id: string; topBrand: string | null; calls: number; at: string }>;

const [base, listPath, ...rest] = process.argv.slice(2);
if (!base || !listPath) {
  console.error("usage: node scripts/warm.ts <baseUrl> <list.json> [--reserve 40] [--state path]");
  process.exit(1);
}
const flag = (name: string, fallback: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : fallback;
};
const RESERVE = Number(flag("--reserve", "40")); // leave this many of today's cap for visitors
const STATE = flag("--state", "scripts/warm-state.json");
const COHORT = !rest.includes("--no-cohort"); // the cohort is 6 calls per entity
const list: Item[] = JSON.parse(readFileSync(listPath, "utf8"));
const done: Done = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};

async function usage(): Promise<{ today: number; cap: number }> {
  return (await fetch(`${base}/api/usage`)).json();
}
async function guard() {
  const u = await usage();
  if (u.today >= u.cap - RESERVE) {
    console.log(`stopping: ${u.today} of ${u.cap} Qloo calls used today (reserve ${RESERVE})`);
    process.exit(0);
  }
  return u.today;
}

// Reads an SSE response to its end and returns the parsed events.
async function events(res: Response): Promise<{ type: string; [k: string]: unknown }[]> {
  if (!res.ok) throw new Error(`${res.url} ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((c) => c.startsWith("data: "))
    .map((c) => JSON.parse(c.slice(6)));
}

for (const item of list) {
  if (done[item.name]) {
    console.log(`skip ${item.name} (warmed ${done[item.name].at})`);
    continue;
  }
  const start = await guard();

  const r = await (await fetch(`${base}/api/resolve?q=${encodeURIComponent(item.name)}`)).json();
  // Only a confident match of the asked-for type. Never guess between candidates.
  const card = r.status === "confident" && r.candidates?.[0]?.type === item.type ? r.candidates[0] : null;
  if (!card) {
    const seen = (r.candidates ?? []).slice(0, 3).map((c: { name: string; type: string }) => `${c.name} (${c.type.replace("urn:entity:", "")})`).join(", ");
    console.log(`${item.name}: ${r.status ?? "error"}${seen ? `, candidates ${seen}` : ""}; skipped`);
    continue;
  }

  await guard();
  const run = await events(await fetch(`${base}/api/run?entity=${card.entity_id}&type=${encodeURIComponent(card.type)}`));
  const failed = run.find((e) => e.type === "error");
  if (failed) throw new Error(`${item.name} run: ${failed.message}`);
  const brands = run.find((e) => e.type === "ranking" && e.domain === "brand")?.data as { kept: { entity_id: string }[] } | undefined;
  // a missing brand ranking means the ranker failed (Oct 23: the Anthropic balance ran out); don't mark this done
  if (!brands) throw new Error(`${item.name} run: no brand ranking (ranker failed); rerun to retry`);
  const topBrand = brands.kept[0]?.entity_id ?? null;
  const trends = run.find((e) => e.type === "trends")?.data ?? {};
  console.log(`${item.name}: slate ok, top brand ${topBrand ?? "none"}, trends ${JSON.stringify(trends)}`);

  if (topBrand) {
    const body = JSON.stringify({ entity: card.entity_id, type: card.type, pick: topBrand, domain: "brand" });
    const post = (path: string) =>
      fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.WARM_TOKEN ? { "x-warm-token": process.env.WARM_TOKEN } : {}) }, body });
    await guard();
    const brief = await events(await post("/api/brief"));
    const err = brief.find((e) => e.type === "error");
    if (err) throw new Error(`${item.name} brief: ${err.message}`);
    console.log(`${item.name}: brief ${brief.find((e) => e.type === "done")?.cached ? "cached" : "generated"}`);
    if (COHORT) {
      await guard();
      const cohort = await (await post("/api/cohort")).json();
      if (cohort.error) throw new Error(`${item.name} cohort: ${cohort.error}`);
      console.log(`${item.name}: cohort ${cohort.cohort?.strongest ?? "no data"}`);
    }
  }

  const calls = (await usage()).today - start;
  done[item.name] = { id: card.entity_id, topBrand, calls, at: new Date().toISOString() };
  writeFileSync(STATE, JSON.stringify(done, null, 2));
  console.log(`${item.name}: ${calls} Qloo calls`);
}
