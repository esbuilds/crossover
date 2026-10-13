// lib/ask/tools.ts
// The ask agent's tools: thin wrappers over Crossover's deterministic code. The model picks which to run and why;
// every name and number comes from here. Each call records a step (n, tool, why, output, summary) for the page and the
// checker. Entity names sit under a key named "name" (lib/ask/check.ts contract). Refusals come back as { error }.
import { insights, search, RESOLVE_TYPES, type Entity } from "../qloo.ts";
import { resolve as resolveName } from "../resolve.ts";
import { identityOf, toRef, type Identity, type Ref, type Twins } from "../review.ts";
import { findRival, type RivalPick } from "../rival.ts";
import { loadVs, type Side, type VsData } from "../rivals.ts";
import { runReview, twinsFor, type ReviewRun } from "../review-run.ts";
import { fromSplit, fromTop50, type Candidate } from "./candidates.ts";
import type { StepRecord } from "./check.ts";

const BRAND = "urn:entity:brand";
const two = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100) / 100);

export type Deps = {
  identify: (q: { query?: string; id?: string; type?: string }) => Promise<Identity>;
  card: (id: string, type: string) => Promise<Entity | null>;
  rival: (seed: Ref) => Promise<RivalPick | null>;
  vs: (a: Side, b: Side) => Promise<VsData | null>;
  top50: (seedId: string) => Promise<Entity[]>;
  cards: (ids: string[]) => Promise<Entity[]>;
  review: (seed: Ref, kept: Identity[]) => Promise<ReviewRun>;
  twins: (group: ReviewRun["groups"][number]) => Promise<Twins | null>;
};

export function qlooDeps(ip: string): Deps {
  return {
    identify: async (q) => {
      if (q.id && q.type) {
        const [hit] = await insights({ "filter.type": q.type, "filter.results.entities": q.id, take: 1 });
        return hit ? { state: "confirmed", input: hit.name, entity: toRef(hit, q.type), via: "chosen id" } : { state: "unresolved", input: q.id };
      }
      const query = (q.query ?? "").trim().slice(0, 100);
      return identityOf(query, await resolveName(query, (await search(query, RESOLVE_TYPES, 5)) as Entity[]));
    },
    card: async (id, type) => (await insights({ "filter.type": type, "filter.results.entities": id, take: 1 }))[0] ?? null,
    rival: async (seed) => {
      const r = await findRival(seed.entity_id, seed.type, false);
      return r && r !== "cold" ? r.result : null;
    },
    vs: (a, b) => loadVs(a, b, ip),
    top50: (seedId) => insights({ "filter.type": BRAND, "signal.interests.entities": seedId, take: 50 }),
    cards: (ids) => insights({ "filter.type": BRAND, "filter.results.entities": ids.join(","), take: ids.length }),
    review: (seed, kept) => runReview(seed, kept, {}, { withTwins: false }),
    twins: (group) => twinsFor(group),
  };
}

type Out = { output: object; summary: string };
export type AskTools = ReturnType<typeof makeTools>;

export function makeTools(deps: Deps, record: (s: StepRecord) => void) {
  let n = 0;
  const st: { seed?: Ref; rival?: { id: string; name: string; type: string }; vs?: VsData; candidates?: Candidate[]; review?: ReviewRun } = {};
  const step = (tool: string, why: string, out: Out): Out => (record({ n: ++n, tool, why, output: out.output, summary: out.summary }), out);
  const refuse = (tool: string, why: string, error: string) => step(tool, why, { output: { error }, summary: error });

  return {
    resolve: async ({ why, name, id, type }: { why: string; name?: string; id?: string; type?: string }) => {
      const r = await deps.identify({ query: name, id, type });
      if (r.state === "confirmed") {
        st.seed = r.entity;
        return step("resolve", why, { output: { state: "confirmed", name: r.entity.name, id: r.entity.entity_id, type: r.entity.type }, summary: `Confirmed ${r.entity.name}` });
      }
      if (r.state === "ambiguous")
        return step("resolve", why, { output: { state: "ambiguous", options: r.options.map((o) => ({ name: o.name, id: o.entity_id, type: o.type })) }, summary: `"${r.input}" could be ${r.options.length} things in Qloo` });
      return step("resolve", why, { output: { state: "unresolved", query: r.input }, summary: `Qloo doesn't know "${r.input}"` });
    },

    findRival: async ({ why }: { why: string }) => {
      if (!st.seed) return refuse("findRival", why, "run resolve first");
      const r = await deps.rival(st.seed);
      if (r?.kind === "pick") {
        st.rival = { id: r.pick.id, name: r.pick.name, type: r.pick.type };
        return step("findRival", why, { output: { found: true, rival: { name: r.pick.name, affinity: two(r.pick.affinity) }, by: r.field === "category" ? `Qloo category ${r.category}` : "genre tag" }, summary: `Closest same-field brand: ${r.pick.name}` });
      }
      return step("findRival", why, { output: { found: false }, summary: "No same-field brand in the fans' top 50" });
    },

    split: async ({ why }: { why: string }) => {
      if (!st.seed) return refuse("split", why, "run resolve first");
      if (!st.rival) return refuse("split", why, "run findRival first; split needs a rival");
      const v = await deps.vs({ id: st.seed.entity_id, type: st.seed.type }, { id: st.rival.id, type: st.rival.type });
      if (!v) return refuse("split", why, "Qloo couldn't compare these two");
      st.vs = v;
      const r = v.rivals;
      return step("split", why, {
        output: {
          closerToSeed: r.leansA.length, closerToRival: r.leansB.length, withinGapOfBoth: r.shared.length, sameField: r.sameField.length,
          seedSide: r.leansA.slice(0, 10).map((x) => ({ name: x.name, seed: two(x.a), rival: two(x.b) })),
          seedMarkets: v.map?.metrosA.map((m) => ({ name: m.name })) ?? [], rivalMarkets: v.map?.metrosB.map((m) => ({ name: m.name })) ?? [],
        },
        summary: `${r.leansA.length} brands sit closer to ${r.a.name}, ${r.leansB.length} closer to ${r.b.name}, ${r.shared.length} within 0.05 of both`,
      });
    },

    candidates: async ({ why, source }: { why: string; source: "split" | "top50" }) => {
      if (!st.seed) return refuse("candidates", why, "run resolve first");
      if (source === "split" && !st.vs) return refuse("candidates", why, "run split first, or use source top50");
      let list: Candidate[];
      if (source === "split") list = fromSplit(st.vs!.rivals.leansA);
      else {
        const seedCard = await deps.card(st.seed.entity_id, st.seed.type);
        list = seedCard ? fromTop50(seedCard, await deps.top50(st.seed.entity_id), st.rival ? [st.rival.id] : []) : [];
      }
      st.candidates = list;
      return step("candidates", why, { output: { source, candidates: list.map((c) => ({ name: c.name, id: c.id })) }, summary: `${list.length} candidates from ${source === "split" ? "the seed's side of the split" : "the fans' top 50, own field left out"}` });
    },

    review: async ({ why, ids }: { why: string; ids: string[] }) => {
      if (!st.seed) return refuse("review", why, "run resolve first");
      const allowed = new Set((st.candidates ?? []).map((c) => c.id));
      const bad = ids.filter((id) => !allowed.has(id));
      if (!ids.length || bad.length) return refuse("review", why, `review only takes ids returned by candidates (${bad.length} weren't)`);
      const kept: Identity[] = (await deps.cards(ids)).map((e) => ({ state: "confirmed", input: e.name, entity: toRef(e, BRAND), via: "chosen id" }));
      const r = await deps.review(st.seed, kept);
      st.review = r;
      const g = r.groups[0];
      const nameOf = (id: string) => g.rows.find((x) => x.entity.entity_id === id)!.entity.name;
      const valueOf = (id: string) => two(g.rows.find((x) => x.entity.entity_id === id)!.forward.value);
      return step("review", why, {
        output: {
          clearThree: g.selection.noClearThree ? [] : g.selection.picks.map((id) => ({ name: nameOf(id), affinity: valueOf(id) })),
          noClearThree: g.selection.noClearThree,
          tiedAtCutoff: g.selection.tiedAtCutoff.map((id) => ({ name: nameOf(id) })),
          groups: g.affinityBands.map((band) => band.map((id) => ({ name: nameOf(id), affinity: valueOf(id) }))),
          fameBands: g.popularityBands.map((band) => band.map((id) => ({ name: nameOf(id) }))),
          ranks: g.rows.map((x) => ({ name: x.entity.name, amongSeedFans: r.ranks[x.entity.entity_id]?.amongSeedFans ?? null, seedAmongTheirs: r.ranks[x.entity.entity_id]?.seedAmongTheirs ?? null })),
          notMeasured: g.rows.filter((x) => x.forward.value === null).map((x) => ({ name: x.entity.name })),
        },
        summary: g.selection.noClearThree ? `No clear three: ${g.affinityBands[0].length} names within 0.05 of the top` : `Measured top: ${g.selection.picks.map(nameOf).join(", ")}`,
      });
    },

    twins: async ({ why }: { why: string }) => {
      if (!st.review) return refuse("twins", why, "run review first");
      const g = st.review.groups[0];
      const t = await deps.twins(g);
      const nameOf = (id: string) => g.rows.find((x) => x.entity.entity_id === id)!.entity.name;
      return t
        ? step("twins", why, { output: { found: true, a: { name: nameOf(t.a) }, b: { name: nameOf(t.b) }, value: two(t.value), next: two(t.next) }, summary: `${nameOf(t.a)} and ${nameOf(t.b)} sit closest to each other` })
        : step("twins", why, { output: { found: false }, summary: "No pair stands out among the contenders" });
    },
  };
}
