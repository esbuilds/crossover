// review-v2 on rows Qloo returned Oct 10 (probe/VERIFY-3.md, out3/profiles.json). No live API.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyMissingRule, assemble, bands, evidenceFor, formatAffinity, gateFor, identityOf, scoreForward, scoreReverse, select,
  type Cell, type Identity, type Ref, type Scorer,
} from "./review.ts";
import type { Entity } from "./qloo.ts";

const B = "urn:entity:brand";
const ref = (name: string, popularity = 0.9, type = B, tags: string[] = ["Soda"]): Ref => ({ entity_id: name, name, type, popularity, tags });

// Liquid Death seed alone, brand group (Metallica is an artist and scored separately)
const LD: Record<string, number> = {
  "Dr. Squatch": 0.5, Yeti: 0.5, Poppi: 0.5, Sheetz: 0.5,
  "e.l.f.": 0.5, "Van Leeuwen": 0.5, Chanel: 0.5,
};
const LD_POP: Record<string, number> = { "Dr. Squatch": 0.939, Yeti: 0.988, Poppi: 0.334, Sheetz: 0.936, "e.l.f.": 0.995, "Van Leeuwen": 0.771, Chanel: 1.0 };
// Mt. Joy seed alone
const MJ: Record<string, number> = {
  Allbirds: 0.5, REI: 0.5, Patagonia: 0.5, "Hydro Flask": 0.5,
  Airbnb: 0.5, "Red Bull": 0.5, "Taco Bell": 0.5, Spotify: 0.5,
};
const rows = (m: Record<string, number>) => Object.entries(m).map(([id, forward]) => ({ id, forward }));

test("missing rule: the two floors are missing wherever they appear", () => {
  const cells = applyMissingRule([0.7649962877984056, 0.55405379801747, 0.8], "one call");
  assert.deepEqual(cells.map((c) => c.missing), ["floor", "floor", undefined]);
});

test("missing rule: 3+ bit-identical values in one call are missing; an exact pair is a real tie", () => {
  const v = 0.5;
  assert.deepEqual(applyMissingRule([v, v, v, 0.9], "one call").map((c) => c.value), [null, null, null, 0.9]);
  // Patagonia and Red Bull, no-seed 35 to 44, Oct 10: same double, both kept
  const p = 0.8250588496729104;
  assert.deepEqual(applyMissingRule([p, p, 0.6], "one call").map((c) => c.value), [p, p, 0.6]);
});

test("missing rule: the same pair repeating across 2+ signals is missing (Liquid Death x e.l.f., four audiences)", () => {
  const v = 0.670650049690628;
  const cells = applyMissingRule([v, v, 0.7, 0.71], "across signals");
  assert.deepEqual(cells.map((c) => c.missing), ["repeats across signals", "repeats across signals", undefined, undefined]);
});

test("missing rule: not returned is null, never zero", () => {
  const [c] = applyMissingRule([undefined], "one call");
  assert.deepEqual(c, { value: null, missing: "not returned" });
  assert.equal(formatAffinity(c), "no measurement");
});

test("formatAffinity: two decimals, no percent", () => {
  const s = formatAffinity({ value: 0.8693 });
  assert.equal(s, "0.87");
  assert.doesNotMatch(s, /%/);
});

test("bands: leader-relative, a band is everything within 0.05 of its strongest member", () => {
  assert.deepEqual(bands(rows(LD), (r) => r.forward).map((b) => b.map((r) => r.id)), [
    ["Dr. Squatch"], ["Yeti"], ["Poppi", "Sheetz"], ["e.l.f.", "Van Leeuwen", "Chanel"],
  ]);
  // steps of 0.04 chain forever in review-v1; leader-relative breaks them every 0.05 from the leader
  const steps = [0.9, 0.86, 0.82, 0.78, 0.74].map((forward, i) => ({ id: String(i), forward }));
  assert.deepEqual(bands(steps, (r) => r.forward).map((b) => b.map((r) => r.id)), [["0", "1"], ["2", "3"], ["4"]]);
});

test("select: Liquid Death picks two and names the tie at the cutoff", () => {
  assert.deepEqual(select(rows(LD)), { picks: ["Dr. Squatch", "Yeti"], tiedAtCutoff: ["Poppi", "Sheetz"], noClearThree: false });
});

test("select: Mt. Joy's top four are one tie, so no clear three", () => {
  assert.deepEqual(select(rows(MJ)), { picks: [], tiedAtCutoff: ["Allbirds", "REI", "Patagonia", "Hydro Flask"], noClearThree: true });
  assert.deepEqual(bands(rows(MJ), (r) => r.forward).map((b) => b.map((r) => r.id)), [
    ["Allbirds", "REI", "Patagonia", "Hydro Flask"], ["Airbnb"], ["Red Bull", "Taco Bell"], ["Spotify"],
  ]);
});

test("select: three clear leaders, missing values never selected", () => {
  assert.deepEqual(select([{ id: "a", forward: 0.9 }, { id: "b", forward: 0.8 }, { id: "c", forward: 0.7 }, { id: "x", forward: null }, { id: "d", forward: 0.6 }]), {
    picks: ["a", "b", "c"], tiedAtCutoff: [], noClearThree: false,
  });
});

test("evidence: picks are stronger unless reverse is low; others weaker unless reverse is high; ties insufficient", () => {
  const rev: Record<string, number | null> = { "Dr. Squatch": 0.6, Yeti: 0.8, Poppi: 0.7, Sheetz: 0.7, "e.l.f.": 0.9, "Van Leeuwen": 0.7, Chanel: null };
  const e = evidenceFor(rows(LD).map((r) => ({ ...r, reverse: rev[r.id] })));
  assert.equal(e["Dr. Squatch"], "mixed directional evidence"); // leads forward, low reverse
  assert.equal(e.Yeti, "stronger measured support");
  assert.equal(e.Poppi, "insufficient evidence"); // tied at the cutoff
  assert.equal(e["e.l.f."], "mixed directional evidence"); // trails forward, high reverse
  assert.equal(e["Van Leeuwen"], "weaker measured support");
  assert.equal(e.Chanel, "weaker measured support"); // reverse missing doesn't rescue or sink it
});

test("evidence: a lone candidate of its type, or a missing forward, is insufficient", () => {
  assert.deepEqual(evidenceFor([{ id: "Metallica", forward: 0.82, reverse: 0.9 }]), { Metallica: "insufficient evidence" });
  assert.equal(evidenceFor([{ id: "a", forward: 0.9, reverse: null }, { id: "b", forward: null, reverse: 0.9 }]).b, "insufficient evidence");
});

test("identity: exact is confirmed, an LLM match stays ambiguous, nothing is unresolved", () => {
  const e = (name: string): Entity => ({ entity_id: name, name, types: [B], popularity: 0.9, akas: [], tags: [] });
  assert.equal(identityOf("Yeti", { status: "confident", match: e("YETI"), alternates: [], via: "exact" }).state, "confirmed");
  const llm = identityOf("Dr Squach", { status: "confident", match: e("Dr. Squatch Soap Co."), alternates: [e("Squatch")], via: "llm", reason: "r" });
  assert.equal(llm.state, "ambiguous");
  assert.equal(llm.state === "ambiguous" && llm.options[0].name, "Dr. Squatch Soap Co.");
  assert.equal(identityOf("Blorpwater", { status: "not_found" }).state, "unresolved");
});

test("identity (review-v3): an exact name another known type also carries is ambiguous; a musician's person/artist pair is not", () => {
  const e = (name: string, type: string, popularity = 0.9): Entity => ({ entity_id: name + type, name, types: [type], popularity, akas: [], tags: [] });
  const corona = identityOf("Corona", { status: "confident", match: e("Corona", "urn:entity:artist"), alternates: [e("Corona", B), e("Corona", "urn:entity:movie", 0)], via: "exact" });
  assert.equal(corona.state, "ambiguous");
  assert.deepEqual(corona.state === "ambiguous" && corona.options.map((o) => o.type), ["urn:entity:artist", B]); // the 0.00 movie is a namesake
  const swift = identityOf("Taylor Swift", { status: "confident", match: e("Taylor Swift", "urn:entity:artist"), alternates: [e("Taylor Swift", "urn:entity:person")], via: "exact" });
  assert.equal(swift.state, "confirmed");
  const dove = identityOf("Dove", { status: "confident", match: e("Dove", B), alternates: [e("Dove", B, 0.71), e("Dove Cameron", "urn:entity:person")], via: "exact" });
  assert.equal(dove.state, "confirmed"); // same-type duplicates keep Qloo's order
});

test("buyer gates: named and tag exclusions are hard; untagged stays unknown", () => {
  assert.deepEqual(gateFor(ref("Sheetz"), "Sheetz", { exclude: [{ name: "sheetz", reason: "regional only" }] }), { state: "excluded", reason: "regional only" });
  assert.deepEqual(gateFor(ref("Coors", 0.9, B, ["Beer"]), "Coors", { excludeTags: ["beer"] }), { state: "excluded", reason: "Qloo tags it beer" });
  assert.equal(gateFor(ref("Mystery", 0.9, B, []), "Mystery", { excludeTags: ["beer"] }).state, "unknown");
  assert.equal(gateFor(ref("Yeti"), "Yeti", {}).state, "eligible");
});

test("adapter: one forward call per type, mixed types never share a call", async () => {
  const calls: Record<string, string | number>[] = [];
  const score: Scorer = async (p) => {
    calls.push(p);
    return String(p["filter.results.entities"]).split(",").map((id) => ({ entity_id: id, affinity: id === "Metallica" ? 0.82 : LD[id] }));
  };
  const cands = [...Object.keys(LD).map((n) => ref(n)), ref("Metallica", 1, "urn:entity:artist")];
  const f = await scoreForward(ref("Liquid Death"), cands, score);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((c) => c["filter.type"]), [B, "urn:entity:artist"]);
  assert.equal(f.Yeti.value, LD.Yeti);
  assert.equal(f.Metallica.value, 0.82);
});

test("adapter: reverse is one call per other-type candidate and applies the across-signals rule", async () => {
  const same = 0.670650049690628;
  const A = "urn:entity:artist";
  let calls = 0;
  const score: Scorer = async (p) => (calls++, [{ entity_id: "Liquid Death", affinity: { a: same, b: same, c: 0.81 }[String(p["signal.interests.entities"])] }]);
  const r = await scoreReverse(ref("Liquid Death"), [ref("a", 1, A), ref("b", 1, A), ref("c", 1, A), ref("Yeti")], score);
  assert.equal(calls, 3); // Yeti is a brand like the seed: symmetric, never fetched
  assert.deepEqual([r.a.missing, r.b.missing, r.c.value], ["repeats across signals", "repeats across signals", 0.81]);
  assert.deepEqual(r.Yeti, { value: null, sameAsForward: true });
});

test("assemble: proxies and unresolved stay out of the measured shortlist; exclusions gate selection only", () => {
  const ids: Identity[] = [
    ...Object.keys(LD).map((n): Identity => ({ state: "confirmed", input: n, entity: ref(n, LD_POP[n]), via: "exact name" })),
    { state: "proxy", input: "Graza", entity: ref("Brightland") },
    { state: "unresolved", input: "Blorpwater" },
  ];
  const fwd: Record<string, Cell> = Object.fromEntries(Object.entries(LD).map(([k, v]) => [k, { value: v }]));
  const review = assemble(ref("Liquid Death"), ids, fwd, {}, { exclude: [{ name: "Yeti", reason: "competitor of a retail partner" }] });
  const g = review.groups[0];
  assert.equal(review.groups.length, 1);
  assert.equal(g.rows.length, 7);
  assert.deepEqual(review.notMeasured.map((i) => i.state), ["proxy", "unresolved"]);
  assert.equal(g.rows.find((r) => r.entity.name === "Yeti")?.evidence, "stronger measured support"); // measured support stands
  // the buyer gate keeps Yeti out of the picks, so the Poppi/Sheetz tie now fits inside three
  assert.deepEqual(g.selection, { picks: ["Dr. Squatch", "Poppi", "Sheetz"], tiedAtCutoff: [], noClearThree: false });
  // popularity reference: Chanel, e.l.f., Yeti, Dr. Squatch, Sheetz within 0.05 of each other; Poppi alone at the bottom
  assert.deepEqual(g.popularityBands.at(-1), ["Poppi"]);
  assert.equal(review.version, "review-v3");
});

test("assemble: picks never read as ties when an excluded name sat in their band (Red Bull, Oct 10)", () => {
  const RB: Record<string, number> = { GoPro: 0.969, Monster: 0.967, Oakley: 0.936, Nike: 0.891, Samsung: 0.815, Hallmark: 0.653 };
  const ids = Object.keys(RB).map((n): Identity => ({ state: "confirmed", input: n, entity: ref(n), via: "exact name" }));
  const fwd = Object.fromEntries(Object.entries(RB).map(([k, v]) => [k, { value: v }]));
  const g = assemble(ref("Red Bull"), ids, fwd, {}, { exclude: [{ name: "Monster", reason: "direct competitor" }] }).groups[0];
  assert.deepEqual(g.selection.picks, ["GoPro", "Oakley", "Nike"]);
  for (const n of g.selection.picks) assert.equal(g.rows.find((r) => r.entity.name === n)?.evidence, "stronger measured support");
  // leader-relative: Monster sits in GoPro's band in the full field, so its measured support stands; the gate excludes it
  assert.equal(g.rows.find((r) => r.entity.name === "Monster")?.evidence, "stronger measured support");
});
