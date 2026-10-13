import type { Metadata } from "next";
import results from "@/audit/results.json";
import replay from "@/audit/replay.json";
import { Chip, SiteHeader } from "../ui";

// The frozen audit (audit/briefs.json audit-v1, run by scripts/audit-run.ts). Derived numbers only: raw Qloo
// responses stay out of the repo. Not linked yet.
export const metadata: Metadata = { title: "Audit", robots: { index: false, follow: false } };

type Brief = (typeof results.briefs)[number];
type Challenge = (typeof results.resolution.challenges)[number];
const FREEZE_COMMIT = "d244ee2";
// Findings worth a line under a brief (decided Oct 11; the frozen protocol itself is unchanged)
const NOTES: Record<string, string> = {
  "Red Bull": "The named gate (Monster Energy) missed Rockstar Energy Drink, which lands in the picks; the drafter labelled Rockstar ambiguous, not a competitor. A tag gate on energy drinks catches it.",
};
const REPLAY_FREEZE = "9b64c6c";
const SOURCE = "https://www.marketingdive.com/news/best-marketing-campaigns-2024-advertising-tactics-cmo-lessons/734003/";

const held = results.briefs.filter((b) => b.set === "heldOut");
const dev = results.briefs.filter((b) => b.set === "dev");
const picksWithRole = (bs: Brief[], role: string) => bs.flatMap((b) => b.groups.flat().filter((x) => x.role === role && b.picks.includes(x.name)));
const withRole = (bs: Brief[], role: string) => bs.flatMap((b) => [...b.groups.flat(), ...b.notMeasured].filter((x) => x.role === role));
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function AuditPage() {
  const asRun = results.resolution.challenges;
  const wrong = asRun.filter((c) => !c.neverWrong);
  const recheck = results.resolutionRecheck?.challenges ?? [];
  const names = held.reduce((n, b) => n + b.groups.flat().length + b.notMeasured.length, 0); // brand-only: no other-type groups
  const unmeasured = held.reduce((n, b) => n + b.notMeasured.length, 0);
  const famous = withRole(held, "famous");
  const famousPicked = picksWithRole(held, "famous");
  const small = withRole(held, "small");
  const smallPicked = picksWithRole(held, "small");

  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
      <SiteHeader href="/" label="Pick three" />
      <section className="pt-8">
        <h1 className="font-display text-2xl sm:text-3xl">Audit</h1>
        <p className="mt-2 max-w-[68ch] text-base text-ink-2">
          Twelve briefs, each a brand and eight brands that could partner with it. Six were used to set the rules; six were held out and run once, after the protocol was frozen (commit{" "}
          <code className="font-mono text-sm">{FREEZE_COMMIT}</code>). Everything below is Qloo&apos;s measured affinity read by the {results.rules} rules: a group is every name within 0.05 of its strongest member, and no order is claimed inside a group.
        </p>
      </section>

      <section className="mt-10 grid gap-6 border-t border-rule pt-6 md:grid-cols-3">
        <Stat figure={`${held.filter((b) => b.picks.length === 3).length} of ${held.length}`} label="held-out briefs with a clear three" />
        <Stat figure={`${famousPicked.length} of ${famous.length}`} label="household names (the drafter's label) among the held-out picks" />
        <Stat figure={`${smallPicked.length} of ${small.length}`} label="small brands (the drafter's label) among the held-out picks" />
      </section>
      <p className="mt-4 max-w-[68ch] text-base text-ink-2">
        Roles like &ldquo;famous&rdquo; and &ldquo;small&rdquo; were written into the briefs before any run, as the drafter&apos;s expectation for coverage. They are not labels of truth, and a real past deal isn&apos;t a positive label either. &ldquo;4 of 6&rdquo; and &ldquo;0 of 12&rdquo; measure the protocol&apos;s output against the drafter&apos;s labels, not whether a partnership works. {unmeasured} of {names} held-out names couldn&apos;t be measured; they are listed, never scored.
      </p>

      <section className="mt-12">
        <h2 className="font-display text-xl">Held-out briefs</h2>
        <ol className="mt-4 grid gap-6 md:grid-cols-2">
          {held.map((b) => (
            <BriefCard key={b.seed} b={b} />
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl">Name resolution</h2>
        <p className="mt-2 max-w-[68ch] text-base text-ink-2">
          Twenty-four typed names: obscure brands, words with several meanings, misspellings and brands that don&apos;t exist. The rule: never confirm the wrong entity. Unresolved or &ldquo;more than one match&rdquo; is allowed.
        </p>
        <p className="mt-4 max-w-[68ch] text-base text-ink">
          As run: {asRun.length - wrong.length} of {asRun.length} never wrong. {count(wrong.length, "failure")}: {wrong.map((c) => `${c.q} confirmed to a namesake`).join("; ")}. Each had an exact-name entity of another type that Qloo listed first.
        </p>
        {recheck.length > 0 && (
          <p className="mt-2 max-w-[68ch] text-base text-ink">
            Fix ({results.resolutionRecheck?.rule}): an exact name that a known entity of another type also carries now asks which one. Rechecked: {recheck.filter((c) => c.neverWrong).length} of {recheck.length} never wrong. That recheck is not a held-out result; the rule was written after seeing these four.
          </p>
        )}
        <details className="mt-4">
          <summary className="cursor-pointer text-base text-ink-2">All 24 names</summary>
          <ul className="mt-3 grid gap-1 text-base sm:grid-cols-2">
            {asRun.map((c, i) => (
              <ResolutionRow key={c.q} c={c} after={recheck[i]} />
            ))}
          </ul>
        </details>
      </section>

      <section className="mt-12 max-w-[68ch]">
        <h2 className="font-display text-xl">One honest counterexample</h2>
        <p className="mt-2 text-base text-ink-2">
          Liquid Death and e.l.f. made Corpse Paint together. It sold out in 45 minutes and drew more than 250 million social impressions (
          <a href={SOURCE} className="underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
            Marketing Dive
          </a>
          ). On a Liquid Death shortlist run Oct 10, e.l.f. measured 0.62, 0.25 below the strongest name and in the lowest group, while being one of the best-known brands on the list. Taste is one input for deciding who to call first, not a verdict on a deal.
        </p>
      </section>

      <section className="mt-12 max-w-[68ch]">
        <h2 className="font-display text-xl">What the ask agent may say</h2>
        <p className="mt-2 text-base text-ink-2">
          The agent on the front page chooses what to measure next and writes the answer, but it can only measure through Crossover&apos;s own tools, and its answer is shown only if every name and number in it appears in a step it cites. When a line doesn&apos;t match, the page shows the steps without the answer and says so. Building it, the check blocked three early answers: two quoted the method&apos;s own numbers (the 0.05 gap, top 50) that no step stated, and one named the rival under a step that didn&apos;t include it. The tools now state those, and every number still has to match a cited step.
        </p>
      </section>

      <Replay />

      <section className="mt-12 max-w-[68ch]">
        <h2 className="font-display text-xl">Doubles, not swaps</h2>
        <p className="mt-2 text-base text-ink-2">
          Measured Oct 13 on the twelve briefs above, after the protocol, so not held out. Each top name scored the others. A three with at least 0.05 less overlap existed in 6 of 12 briefs, but every one gave up more than 0.05 of fit with the seed, and two dropped the strongest name (Liquid Death would trade Death Wish Coffee, 0.83, for Nike, 0.67). So the reveal never suggests a swap. It only names a pair of top names whose audiences sit 0.05 or more closer to each other than any other pair: REI and Patagonia for Mt. Joy (0.97, next 0.89), and 5 of 11 briefs that ran.
        </p>
      </section>

      <section className="mt-12 max-w-[68ch]">
        <h2 className="font-display text-xl">Rivals and the collision map</h2>
        <p className="mt-2 text-base text-ink-2">Measured Oct 11 on the hackathon API (probe/VERIFY-4.md and the build reports). These are limits of the front door, not held-out results.</p>
        <ul className="mt-4 grid gap-4 text-base text-ink">
          <li>
            <span className="font-semibold">Chelsea vs Arsenal fails both gates.</span> Of 60 brands in the two top-50 lists, 6 lean Chelsea, none lean Arsenal and 54 are shared, and the two maps share 9 of their top 10 US metros. To Qloo, two Premier League clubs read as one US audience, so the pair isn&apos;t offered. The other three test pairs passed both gates.
          </li>
          <li>
            <span className="font-semibold">The map compares percentiles, not raw ranks.</span> Each side&apos;s heatmap rank is skewed by how many cells it carries (Olipop&apos;s matched cells sit 0.24 above Poppi&apos;s at the median), so a raw diff paints most of the country one colour. Each side is re-ranked within the cells both carry. A cell leans one way at a gap of 0.25 or more, only cells in at least one side&apos;s top half are drawn, and the page shows a lean per cell, never a number.
          </li>
          <li>
            <span className="font-semibold">The same-field cut has a ceiling.</span> A brand sharing a second-level genre tag with either side (baseball, drinks) moves out of the columns into its own group. Tags are kept to 12 per brand, so a brand whose genre tag sits past the cut (Juventus) can slip into the columns. The top-level tag was tried first and was too broad: food and beverage took 57 of Olipop vs Poppi&apos;s 89 names and emptied Poppi&apos;s column.
          </li>
          <li>
            <span className="font-semibold">The rival finder picks for 7 of 9 test brands,</span> 4 by genre tag and 3 by Qloo&apos;s product category: Olipop, Erewhon and A24 carry no brand genre tag in 98 to 114 tags each. A24 finds nothing in its top 50 and gets Qloo&apos;s competitor labels only. Artists and people get brand chips, never an automatic pair. Erewhon&apos;s pick (Clean) shares a supplements tag and is off-axis; Qloo&apos;s labels under it name the real grocers.
          </li>
          <li>
            <span className="font-semibold">Qloo has one Stanley brand, and it reads as tools.</span> Typed &ldquo;Stanley&rdquo; asks brand or artist. The brand is the same entity the YETI vs Stanley pair uses, picked for its bottles and tumblers, but its competitor labels are Milwaukee Tool, DeWalt and Craftsman. That&apos;s Qloo&apos;s data; we don&apos;t override it.
          </li>
          <li>
            <span className="font-semibold">An age bracket doesn&apos;t split the map.</span> Run real Oct 12, before anything was built (8 calls, scripts/age-probe.ts). At 24 and under, every drawn cell reads &ldquo;both&rdquo; (Olipop vs Poppi 1,500 of 1,500; Liquid Death vs Celsius 1,485). At 55 and over, a slight lean. 0 percent of leaned cells flip between the brackets, against a 15 percent gate, and about 40 of the 1,500 hottest cells are shared between them. An age-bracketed heatmap shows where that bracket lives, not where the two brands part, so the map stays national.
          </li>
          <li>
            <span className="font-semibold">A typed aisle can&apos;t ship honestly.</span> Probe run real Oct 12 (9 calls, scripts/aisle-probe.ts): Qloo&apos;s brand tag that best matches a typed category, then its top twelve brands. Running shoes, hard seltzer and skincare gave lists a partnerships lead would recognise. &ldquo;Streaming services&rdquo; matched &ldquo;Financial Services&rdquo; and returned banks, and &ldquo;fast-casual burgers&rdquo; matched no tag at all: 3 of 5 against a gate of 4. A word match that confidently shows the wrong aisle is the reason the three aisles stay prepared.
          </li>
          <li>
            <span className="font-semibold">A brand&apos;s footprint decides an aisle map, so the leaders map uses three.</span> Run real Oct 12 on cached heatmaps (scripts/leaders-probe.ts), gate: no brand above its share limit, and most coloured cells agreeing with their neighbours. All nine energy brands, each ranked within its own cells: Red Bull leads 47.0% of 6,134 coloured cells, because its map has 11,060 cells and 5-hour Energy&apos;s 1,235, so a small map can&apos;t lead where it has no reading (69.8% regional; fails the 40% share limit). Ranked within the 1,208 cells all nine carry: largest share 18.5%, but only 56.4% regional. The top four by cell count (Red Bull, Monster, Bang, Rockstar; 7,018 shared cells): 40.4% and 75.0%, but Celsius drops out. The camp heads (Red Bull, Monster, Celsius; 3,957 shared cells, all of Celsius&apos;s map): Celsius 43.1%, 80.1% regional. The shipped rule: three camp heads per aisle, ranked within the cells all three carry, gate of at least 3,000 shared cells, no brand above 50%, at least 60% regional. Soda passes with Olipop, LaCroix and Simply Pop (4,681 cells; 41.2%; 78.3%; Poppi shares only 1,961). Outdoor fails on regions (Patagonia, The North Face, REI: 11,240 cells; 35.2%; 56.5%) and has no leaders map.
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <details>
          <summary className="cursor-pointer font-display text-xl">Dev briefs (the rules were tuned on these)</summary>
          <ol className="mt-4 grid gap-6 md:grid-cols-2">
            {dev.map((b) => (
              <BriefCard key={b.seed} b={b} />
            ))}
          </ol>
        </details>
      </section>

      <section className="mt-12 max-w-[68ch] border-t border-rule pt-4 text-sm text-ink-3">
        <p>What this doesn&apos;t establish: purchases, visits, commercial eligibility, or whether a deal makes money.</p>
        <p className="mt-2">
          Method: brand names resolved brand-only; buyer gates come from each brief and are examples, not facts about the companies. Affinities are rounded to two decimals; Qloo&apos;s raw responses aren&apos;t published. Protocol and rules: audit/briefs.json, lib/review.ts. Run {results.ranAt}.
        </p>
      </section>
    </main>
  );
}

function Stat({ figure, label }: { figure: string; label: string }) {
  return (
    <div>
      <p className="font-display text-3xl tabular-nums">{figure}</p>
      <p className="mt-1 text-base text-ink-2">{label}</p>
    </div>
  );
}

function BriefCard({ b }: { b: Brief }) {
  const leader = b.groups[0]?.[0]?.affinity ?? 0;
  const excluded = new Map(b.excluded.map((x) => [x.name, x.reason]));
  return (
    <li className="rounded-lg border border-rule bg-surface p-4">
      <h3 className="font-display text-lg">{b.seed}</h3>
      <p className="mt-1 text-base text-ink">
        {b.noClearThree ? "No clear three." : b.picks.length ? `Picks: ${b.picks.join(", ")}.` : "No picks."}
        {b.tiedAtCutoff.length > 0 && ` Then a tie: ${b.tiedAtCutoff.join(", ")}.`}
      </p>
      <ol className="mt-3 grid gap-2">
        {b.groups.map((g, i) => (
          <li key={i} className="border-t border-rule pt-2">
            <p className="text-sm text-ink-3">{i === 0 ? "Top group" : `${(leader - (g[0].affinity ?? 0)).toFixed(2)} below the top`}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-base">
              {g.map((x) => (
                <span key={x.name} className={excluded.has(x.name) ? "text-ink-3 line-through" : b.picks.includes(x.name) ? "font-semibold text-ink" : "text-ink"}>
                  {x.name} <span className="text-sm tabular-nums text-ink-3">{x.affinity?.toFixed(2)}</span> {x.role && <span className="text-xs text-ink-3">{x.role === "ambiguous" ? "ambiguous name" : x.role}</span>}
                </span>
              ))}
            </p>
          </li>
        ))}
      </ol>
      {b.excluded.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <Chip kind="excluded" /> {b.excluded.map((x) => `${x.name} (${x.reason})`).join(", ")}
        </p>
      )}
      {NOTES[b.seed] && <p className="mt-2 text-sm text-ink-2">{NOTES[b.seed]}</p>}
      {b.notMeasured.length > 0 && <p className="mt-2 text-sm text-ink-2">Not measured: {b.notMeasured.map((x) => `${x.name} (${x.state === "ambiguous" ? "more than one match" : "no Qloo match"})`).join(", ")}</p>}
    </li>
  );
}

function ResolutionRow({ c, after }: { c: Challenge; after?: Challenge }) {
  const said = (x: Challenge) => (x.state === "confirmed" ? `confirmed ${x.shown[0]}` : x.state === "ambiguous" ? "asks which one" : "no match");
  return (
    <li className={c.neverWrong ? "text-ink" : "text-danger"}>
      {c.q} <span className="text-sm text-ink-3">({c.kind})</span>: {said(c)}
      {after && after.state !== c.state && <span className="text-ink-2"> → {said(after)}</span>}
    </li>
  );
}

// Historical replay (audit/replay-protocol.md, replay-v1): published as run, pass or fail
function Replay() {
  const sum = replay.summary!;
  const scored = replay.cases.filter((c) => c.result?.state === "scored");
  const dropped = replay.cases.filter((c) => c.dropped);
  return (
    <section className="mt-12">
      <h2 className="font-display text-xl">Would it have found real partners?</h2>
      <p className="mt-2 max-w-[68ch] text-base text-ink-2">
        Real brand collaborations, each with a public source. For each, the real partner sits among seven decoys from its own Qloo category and fame band, chosen by rule with no taste score read; then the seed&apos;s fans score all eight. Protocol frozen before the run (commit <code className="font-mono text-sm">{REPLAY_FREEZE}</code>, audit/replay-protocol.md): a hit is the real partner in the top three, and passing needed {sum.need} hits of {sum.scored}.
      </p>
      <p className="mt-3 max-w-[68ch] text-lg text-ink">
        {sum.pass ? "It passes" : "It fails its bar"}: {sum.hits} of {sum.scored} real partners in the top three (needed {sum.need}; chance gives about {(sum.scored * 3 / 8).toFixed(1)}). No real partner ranked below {Math.max(...scored.map((c) => c.result!.rank!))}th, and the mean rank is {sum.meanRank} against {sum.chanceMeanRank} by chance, reported but not part of the bar.
      </p>
      <ul className="mt-4 grid max-w-[900px] gap-x-8 md:grid-cols-2">
        {scored.map((c) => (
          <li key={c.seed + c.partner} className="border-t border-rule py-3 text-sm text-ink-2">
            <p className="text-base text-ink">
              {c.seed} x {c.partner} <span className="text-ink-3">({c.year})</span>: <span className="tabular-nums">#{c.result!.rank} of {c.result!.of}</span>
            </p>
            <p className="mt-1 tabular-nums">
              {c.result!.affinity!.toFixed(2)} against a top of {c.result!.top!.toFixed(2)}. Decoys: {c.decoys!.map((d) => d.name).join(", ")}.{" "}
              <a href={c.source} className="underline decoration-rule-strong underline-offset-4 hover:decoration-ink">Source</a>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-[68ch] text-sm text-ink-2">
        Dropped before scoring: {dropped.map((c) => `${c.seed} x ${c.partner}`).join("; ")}. Four had no Qloo category tag for the partner; four had a tag that isn&apos;t the partner&apos;s category. Red Bull x GoPro and Liquid Death x e.l.f. were left out because their scores were already seen. A deal that happened is a decision, not proof it worked.
      </p>
    </section>
  );
}
