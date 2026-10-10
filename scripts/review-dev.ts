// Re-read the dev briefs under the current review rules (Oct 11 brief). Starts from the stored /api/review results in
// probe/out-review/ (zero calls); names that resolved to the wrong entity type are re-searched brand-only and only
// those briefs get a new forward call. Writes the new reviews next to the old ones as <seed>.v2.json.
//
//   QLOO_DAILY_CAP=<counter + hard stop> node --env-file=.env.local scripts/review-dev.ts <out-review dir>
import { readFileSync, writeFileSync } from "node:fs";
import { insights, search, qlooCallCount, type Entity } from "../lib/qloo.ts";
import { resolve } from "../lib/resolve.ts";
import { assemble, identityOf, toRef, scoreForward, scoreReverse, type Cell, type Identity, type Review } from "../lib/review.ts";

const dir = process.argv[2];
const BRAND = "urn:entity:brand";
const audit = JSON.parse(readFileSync("audit/briefs.json", "utf8"));
// The buyer's pick where even a brand-only search leads with the wrong company (Hallmark: Channel first, Cards second).
const CHOSEN: Record<string, string> = { Hallmark: "CEA5AD28-DCD4-4972-8679-0D27559D46D2" };

for (const seedName of audit.split.dev as string[]) {
  const old: Review = JSON.parse(readFileSync(`${dir}/${seedName}.json`, "utf8"));
  const buyer = audit.briefs.find((b: { seed: string }) => b.seed === seedName).buyer;
  const ids: Identity[] = [...old.notMeasured];
  const forward: Record<string, Cell> = {};
  let rescored = false;
  for (const g of old.groups)
    for (const r of g.rows) {
      const chosen = CHOSEN[r.input];
      if (chosen && r.entity.entity_id !== chosen) {
        const hit = ((await search(r.input, [BRAND], 5)) as Entity[]).find((e) => e.entity_id === chosen)!;
        ids.push({ state: "confirmed", input: r.input, entity: toRef(hit, BRAND), via: "chosen id" });
        rescored = true;
      } else if (r.entity.type === BRAND) {
        ids.push({ state: "confirmed", input: r.input, entity: r.entity, via: "exact name" });
        forward[r.entity.entity_id] = r.forward;
      } else {
        ids.push(identityOf(r.input, await resolve(r.input, (await search(r.input, [BRAND], 5)) as Entity[])));
        rescored = true;
      }
    }
  const measured = ids.flatMap((i) => (i.state === "confirmed" ? [i.entity] : []));
  const fwd = rescored ? await scoreForward(old.seed, measured, (p) => insights(p)) : forward;
  const review = assemble(old.seed, ids, fwd, await scoreReverse(old.seed, measured, (p) => insights(p)), buyer);
  writeFileSync(`${dir}/${seedName}.v2.json`, JSON.stringify(review, null, 2));
  const name = (id: string) => measured.find((m) => m.entity_id === id)?.name ?? id;
  for (const g of review.groups) {
    const val = (id: string) => g.rows.find((r) => r.entity.entity_id === id)!.forward.value!.toFixed(3);
    console.log(`\n${seedName}${rescored ? " (re-scored)" : ""}: picks ${g.selection.picks.map(name).join(", ") || "none"}${g.selection.noClearThree ? " [no clear three]" : ""}; tied at cutoff ${g.selection.tiedAtCutoff.map(name).join(", ") || "none"}`);
    console.log("  bands: " + g.affinityBands.map((b) => b.map((id) => `${name(id)} ${val(id)}`).join(" / ")).join("  |  "));
    const ex = g.rows.filter((r) => r.gate.state === "excluded").map((r) => `${r.entity.name} (${r.gate.state === "excluded" && r.gate.reason})`);
    if (ex.length) console.log("  excluded: " + ex.join(", "));
  }
  console.log("  not measured: " + (review.notMeasured.map((i) => `${i.input} (${i.state})`).join(", ") || "none"));
}
console.log(`\nQloo calls this run: ${qlooCallCount()}`);
