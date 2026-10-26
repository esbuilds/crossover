import type { Metadata } from "next";
import type { ReactNode } from "react";
import control from "@/audit/replay-control.json";
import reverse from "@/audit/replay-reverse.json";
import Link from "next/link";
import results from "@/audit/results.json";
import replay from "@/audit/replay.json";
import replayV2 from "@/audit/replay-v2.json";
import blocked from "@/lib/ask/blocked.json";
import replayAsk from "@/lib/ask/replay-ask.json";
import judgeNames from "@/audit/judge-names.json";
import mutation from "@/audit/mutation.json";
import { forDisplay } from "@/lib/ask/check.ts";
import { btnPrimary, Chip, linkInline, panel, panelStrong, SiteHeader, shell } from "../ui";
import { askLinks } from "@/lib/ask/links.ts";
import { PREPARED_ASKS } from "@/lib/ask/prepared.ts";
import { ReplayControls } from "./replay-controls";
import { AgentForks } from "./agent-forks";
import { StripImage } from "../replay/strip-image";

// The frozen audit (audit/briefs.json audit-v1, run by scripts/audit-run.ts). Derived numbers only: raw Qloo
// responses stay out of the repo. Not linked yet.
export const metadata: Metadata = { title: "Audit", robots: { index: false, follow: false } };

type Brief = (typeof results.briefs)[number];
type Challenge = (typeof results.resolution.challenges)[number];
const FREEZE_COMMIT = "5120305";
// Findings worth a line under a brief (decided Oct 11; the frozen protocol itself is unchanged)
const NOTES: Record<string, string> = {
  "Red Bull": "The named gate (Monster Energy) missed Rockstar Energy Drink, which lands in the picks; the drafter labelled Rockstar ambiguous, not a competitor. A tag gate on energy drinks catches it.",
};
const REPLAY_FREEZE = "977561c";
const REPLAY_V2_FREEZE = "ef1c2d5";
// From scripts/markets-probe.ts, real Oct 15: metros scoring within one point of each brand's fifth (lib/cities.ts over-index)
// From scripts/reverse-probe.ts, real Oct 15: the seed's rank among each candidate's fans' top 50 of its type ("out": not in it)
const REVERSE_RANKS: [string, string, string, boolean][] = [
  ["Allbirds", "Bombas 1, Warby Parker 11, ClassPass 16", "9, 12, 30, 31, out", true],
  ["Mt. Joy", "Outdoor Voices 26, Allbirds 4, Alternative Apparel out", "28, out, out, out, out", true],
  ["Coca-Cola (the Converse replay)", "Converse out, Vans out", "all out", false],
];
const MARKET_TIES: [string, number][] = [["Allbirds", 13], ["Bombas", 7], ["Warby Parker", 26], ["ClassPass", 8], ["Parachute", 14], ["Tuft & Needle", 11], ["Felix Gray", 7], ["Quince", 12], ["Summersalt", 8]];
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
    <main className={shell}>
      <SiteHeader href="/" label="Pick three" />
      <section className="pt-page">
        <h1 className="font-display text-2xl sm:text-3xl">Audit</h1>
        <p className="mt-3 max-w-copy text-lg text-ink-2 sm:mt-4">Every test here was frozen in git before it ran, and every result is published as it came out, misses included. What we tried to break comes first: the checker, then the replay and the two controls that undid its best number. The held-out briefs, the agent&apos;s blocked answers and the known limits follow.</p>
      </section>

      {/* W5b (judge round, real Oct 25): what we tried to break leads, in sentences, not tiles. Every number is read
          from its file; row two keeps "both controls failed" beside the replay's number. The six counts that were tiles
          stay, folded, as a plain list. */}
      <section aria-labelledby="tried" className={`${panelStrong} mt-block max-w-[900px] p-4 sm:p-6`}>
        <h2 id="tried" className="font-display text-xl">What we tried to break</h2>
        <ul className="mt-3 max-w-copy text-base text-ink">
          <li className="pt-1"><span className="font-semibold">The checker.</span> We copied every answer the site shows and changed one fact per copy, {mutation.gated.of} copies in all. The checker caught {mutation.gated.rejected}; the {mutation.gated.of - mutation.gated.rejected} that got through are listed below. <a href="#fool-it" className={linkInline}>What got through</a></li>
          <li className="mt-3 border-t border-rule pt-3"><span className="font-semibold">The replay&apos;s best number.</span> The real partner made the top three {control.summary.realHits} of {control.summary.cases} times. Two controls, each frozen in git before its first call, tested that. With a wrong brand swapped in, it still made the top three {control.summary.scrambledHits} of {control.summary.cases} times; ranked the other way, {reverse.summary.realHits} against {reverse.summary.scrambledHits} for a wrong brand. Both controls failed: the lists favor the real partner whoever is asking, and the replay doesn&apos;t show that a brand&apos;s taste picks its partner. <a href="#replay-controls" className={linkInline}>The controls</a></li>
          <li className="mt-3 border-t border-rule pt-3"><span className="font-semibold">Six names a judge might type,</span> run on the live site before judging against a bar written first. It failed, and all six results are published. <a href="#judge-names" className={linkInline}>The six names</a></li>
          <li className="mt-3 border-t border-rule pt-3"><span className="font-semibold">The agent&apos;s own answers.</span> The checker has blocked {blocked.length}; {blocked.filter((b) => b.underV2 !== "passes").length} still fail the current rule. Each is listed with the sentence that failed. <a href="#checker" className={linkInline}>The blocked answers</a></li>
        </ul>
        <p className="mt-5"><Link href={askLinks(PREPARED_ASKS[0].body, PREPARED_ASKS[0].body).share} className={btnPrimary}>Try to fool the checker yourself</Link></p>
        <details className="mt-5 border-t border-rule pt-3">
          <summary className="cursor-pointer text-sm text-ink-2">Every count on this page, in one list</summary>
          <dl className="mt-3 grid gap-y-2 text-sm text-ink-2">
            {([
              // the attacked checker leads (DES-8, real Oct 23): the line under every answer, from audit/mutation.json
              ["Altered answers caught", <a key="m" href="#fool-it" className={linkInline}>{mutation.gated.rejected} of {mutation.gated.of}</a>, ""],
              ["Cached asks (Oct 15)", "39", ""],
              ["Reached a decision", "36", "(3 stopped at the name)"],
              ["Distinct routes", "5", ""],
              ["Blocked by the checker", `${blocked.length}`, `${blocked.filter((b) => b.underV2 !== "passes").length} under the current rule`],
              // pooled with its control, as on /replay (AUDIT-STAT, real Oct 22): both counts from audit/replay-control.json
              // the verdict on the tile itself (SCORE-4, real Oct 23), so the tile alone doesn't read as a found effect
              ["Replays, real partner in the top three", `${control.summary.realHits} of ${control.summary.cases}`, <><a href="#replay-controls" className={linkInline}>and {control.summary.scrambledHits} of {control.summary.cases} with the seed scrambled</a><span>; both controls failed: the lists favor the real partner whoever is asking</span></>],
            ] as [string, ReactNode, ReactNode][]).map(([k, lead, rest]) => (
              <div key={k} className="flex flex-wrap gap-x-2">
                <dt className="text-ink-3">{k}</dt>
                <dd className="text-ink tabular-nums">{lead}</dd>
                {rest && <dd className="text-ink-3">{rest}</dd>}
              </div>
            ))}
          </dl>
        </details>
      </section>
      {/* W2 merge: DEMO_AUDIT_NOTICE renders here when isDemoAudit() (lib/demo-audit.ts on oct25-repo-data) */}

      {/* persona round 2 (both readers): the page is long; a contents list up top */}
      <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {[["#fool-it", "Can the checker be fooled?"], ["#replays", "Real partners, replayed"], ["#counterexample", "The counterexample"], ["#checker", "What the agent may say, and what was blocked"], ["#probes", "Probes, the judge names and the limits"], ["#held-out", "Held-out briefs"], ["#api-notes", "Notes on the API"]].map(([href, label]) => (
          <a key={href} href={href} className={`text-ink-2 ${linkInline}`}>{label}</a>
        ))}
      </nav>
      {/* W5b (real Oct 25): the page's working words, said once in plain terms before the sections use them */}
      <p className="mt-4 max-w-copy text-sm text-ink-2">Words this page uses: the <span className="text-ink">seed</span> is the brand a test asks about; a <span className="text-ink">protocol</span> is a test&apos;s plan, written and frozen in git before its first call; a <span className="text-ink">pass mark</span> is the result the plan said would count as a pass; <span className="text-ink">held out</span> means kept back from tuning and run once, after the rules were frozen; a <span className="text-ink">probe</span> is a one-off measurement run to decide whether to build something; a <span className="text-ink">buyer gate</span> is a brand or kind of brand a brief rules out.</p>

      {/* W5b: the attack on the checker first, then the replay with its controls (what we tried to break leads) */}
      {/* moonshots round 4, real Oct 18: the checker attacked by script before a visitor gets to try (scripts/mutation-gate.ts) */}
      <section id="fool-it" className="mt-section max-w-copy scroll-mt-4">
        <h2 className="font-display text-xl">Can the checker be fooled?</h2>
        <p className="mt-3 text-base text-ink-2">
          Every answer the site shows ({mutation.answers} cached on {mutation.date}) was copied and one fact was changed per copy: a score moved by 0.03, a rank or count moved by one, a brand swapped, a citation pointed at the wrong step. The checker re-checked each copy. 0 Qloo calls, 0 model calls. Today&apos;s rule rejects {mutation.gated.rejected} of {mutation.gated.of}; each kind is below, with what got through. Any answer on the site has a &ldquo;Try to fool the checker&rdquo; box that runs the same code on your edit.
        </p>
        {/* W5b (real Oct 25): the rule versions behind that number, folded; the paragraph as it read before is kept whole */}
        <details className="mt-2">
          <summary className="cursor-pointer text-base text-ink-2">How the rule got there: two gaps found by this test, one found later, all three closed</summary>
        <p className="mt-2 text-base text-ink-2">
          Every answer the site shows ({mutation.answers} cached on {mutation.date}) was copied and one fact was changed per copy: a score moved by 0.03, a rank or count moved by one, a brand swapped, a citation pointed at the wrong step. The checker re-checked each copy. 0 Qloo calls, 0 model calls. Under rule {mutation.before.rule} it rejected {mutation.before.rejected} of {mutation.before.of}; the misses showed two holes, both closed in rule v3, which rejected {mutation.v3.rejected} of {mutation.v3.of} on {mutation.v3.date}. On {mutation.gap.found} a third hole was found: a rank at the end of a sentence (&ldquo;rank 9.&rdquo;) wasn&apos;t bound to the brand it was said of, and this test&apos;s own rank tamper skipped the same numbers. With the tamper corrected, rule v3 rejects {mutation.v3.withNewTamper.rejected} of {mutation.v3.withNewTamper.of}, under the gate&apos;s 95 in 100; rule {mutation.rule} (commit <code className="font-mono">{mutation.gap.fix}</code>) rejects {mutation.gated.rejected} of {mutation.gated.of}. Any answer on the site has a &ldquo;Try to fool the checker&rdquo; box that runs the same code on your edit.
        </p>
        </details>
        <ul className="mt-3 max-w-copy space-y-2 text-sm text-ink-2">
          {mutation.kinds.map((k) => (
            <li key={k.kind} className="border-t border-rule pt-2">
              <p className="text-ink"><span>{k.rejected} of {k.applied}</span> rejected: {k.kind}{k.gated ? "" : " (a known limit, not counted above)"}.</p>
              {k.misses.length > 0 && k.gated && (
                <details className="mt-1">
                  <summary className="cursor-pointer">What got through ({k.misses.length})</summary>
                  <ul className="mt-1 space-y-1">{k.misses.map((m, i) => <li key={i}>{m.seed}: &ldquo;{forDisplay(m.text)}&rdquo;</li>)}</ul>
                </details>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-base text-ink-2">What got through, read by hand: seven of the eight nudged scores became 1.00, which the checker reads as the brand&apos;s own rank of 1 (it compares decimals at two places, so 1.00 and 1 are the same number to it); the eighth landed on another of Backcountry&apos;s own scores. The three ranks that got through sit in sentences that open with &ldquo;It&rdquo; or no brand at all, so there is no brand to bind them to. The known limit: a brand that no step ever returned, typed without the agent&apos;s brackets, can&apos;t be matched by name. The agent brackets every name it writes, and the box on the answer page brackets any new capitalised name you type, so swapping in &ldquo;Nike&rdquo; there is rejected.</p>
      </section>

      <Replay />

      <section className="mt-section border-t border-rule-strong pt-6">
        <h2 className="font-display text-xl">Held-out briefs, a separate and earlier test (Oct 10)</h2>
        <p className="mt-3 max-w-copy text-base text-ink-2">
          These briefs have their own eight names each, written before any run, so their picks differ from the front page&apos;s asks. Twelve briefs, each a brand and eight brands that could partner with it. Six were used to set the rules; six were held out and run once, after the protocol was frozen (commit{" "}
          <code className="font-mono text-sm">{FREEZE_COMMIT}</code>). Everything below is Qloo&apos;s measured affinity read by the {results.rules} rules: a group is every name within 0.05 of its strongest member, and no order is claimed inside a group.
        </p>
      </section>

      <section className="mt-block grid gap-x-12 gap-y-8 border-t border-rule pt-block md:grid-cols-3">
        <Stat figure={`${held.filter((b) => b.picks.length === 3).length} of ${held.length}`} label="held-out briefs with a clear three" />
        <Stat figure={`${famousPicked.length} of ${famous.length}`} label="household names (the drafter's label) among the held-out picks" />
        <Stat figure={`${smallPicked.length} of ${small.length}`} label="small brands (the drafter's label) among the held-out picks" />
      </section>
      <p className="mt-block max-w-copy text-base text-ink-2">
        Roles like &ldquo;famous&rdquo; and &ldquo;small&rdquo; were written into the briefs before any run, as the drafter&apos;s expectation for coverage. They are not labels of truth, and a real past deal isn&apos;t a positive label either. &ldquo;4 of 6&rdquo; and &ldquo;0 of 12&rdquo; measure the protocol&apos;s output against the drafter&apos;s labels, not whether a partnership works. {unmeasured} of {names} held-out names couldn&apos;t be measured; they are listed, never scored.
      </p>

      <section id="held-out" className="mt-section scroll-mt-4">
        <h2 className="font-display text-xl">Held-out briefs</h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-2">
          {held.map((b) => (
            <BriefCard key={b.seed} b={b} />
          ))}
        </ol>
      </section>

      <section className="mt-section">
        <h2 className="font-display text-xl">Name resolution</h2>
        <p className="mt-3 max-w-copy text-base text-ink-2">
          Twenty-four typed names: obscure brands, words with several meanings, misspellings and brands that don&apos;t exist. The rule: never confirm the wrong entity. Unresolved or &ldquo;more than one match&rdquo; is allowed.
        </p>
        <p className="mt-4 max-w-copy text-base text-ink">
          As run: {asRun.length - wrong.length} of {asRun.length} never wrong. {count(wrong.length, "failure")}: {wrong.map((c) => `${c.q} confirmed to a namesake`).join("; ")}. Each had an exact-name entity of another type that Qloo listed first.
        </p>
        {recheck.length > 0 && (
          <p className="mt-2 max-w-copy text-base text-ink">
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

      <section id="counterexample" className="mt-section max-w-copy scroll-mt-4">
        <h2 className="font-display text-xl">One honest counterexample</h2>
        <p className="mt-3 text-base text-ink-2">
          Liquid Death and e.l.f. made Corpse Paint together. It sold out in 45 minutes and drew more than 250 million social impressions (
          <a href={SOURCE} className={linkInline}>
            Marketing Dive
          </a>
          ). On a Liquid Death shortlist run Oct 10, e.l.f. measured 0.62, 0.25 below the strongest name and in the lowest group, while being one of the best-known brands on the list. Taste is one input for deciding who to call first, not a verdict on a deal.
        </p>
      </section>

      <AgentForks />

      <section id="checker" className="mt-section max-w-copy scroll-mt-4">
        <h2 className="font-display text-xl">What the ask agent may say</h2>
        <p className="mt-3 text-base text-ink-2">
          The agent on the front page chooses what to measure next and writes the answer, but it can only measure through Crossover&apos;s own tools, and its answer is shown only if every name and number in it appears in a step it cites. When a line doesn&apos;t match, the page shows the steps without the answer and says so. Each prepared ask&apos;s candidates (eight for Allbirds and Mt. Joy, six for Calm) tie within 0.05 by taste, because they come from the top 50 of the seed&apos;s own affinity list; the three shown are the agent&apos;s pick inside the tie, with its reason in the trace, and the overlap check is shown whether it finds a pair or not.
        </p>
        <p className="mt-3 text-base text-ink">The checker has blocked {blocked.length} answers so far; blocked under the current rule: {blocked.filter((b) => b.underV2 !== "passes").length}. Each, with the sentence that failed, the reason and what the current rule says:</p>
        {/* W5b (real Oct 25): the rule's version history, folded under a plain summary; every line kept */}
        <details className="mt-1">
          <summary className="cursor-pointer text-base text-ink-2">How the rule changed: twice, each time after a test found a gap, and every earlier answer re-checked</summary>
        <p className="mt-2 text-base text-ink-2">The rule was refined on Oct 15 (rule v2) after the judge-name probe blocked a true answer for Noah Kahan: a number after &ldquo;against&rdquo;, &ldquo;versus&rdquo;, &ldquo;while&rdquo;, &ldquo;for the others&rdquo;, a count of others (&ldquo;seven others&rdquo;) or a semicolon now has to be the next named brand&apos;s own number, or with none named, another candidate&apos;s, instead of the brand before the comma&apos;s. Every number still has to be in a cited step. Before it shipped, all 29 cached answers that passed still passed (33 on a re-run the same afternoon, 0 failing), the three real failures below still block, and a test proves a misattributed number still blocks. Answers are re-checked under the current rule when shown; the stored runs aren&apos;t changed.</p>
        <p className="mt-2 text-base text-ink-2">Rule v3 (Oct 18) came from attacking the checker, below: a score written after the seed&apos;s name, and any rank, now has to be the named brand&apos;s own. The three frozen answers check identically, all 33 cached answers that passed still pass, and every entry in this list reads the same under v3 as under v2.</p>
        </details>
        <p className="mt-1 text-base text-ink-2">The checker reads names and numbers, not meaning; a true sentence can be blocked, a misleading one with correct numbers can pass.</p>
        <ul className="mt-2 max-w-copy space-y-2 text-sm text-ink-2">
          {blocked.map((b) => (
            <li key={b.ask + b.version} className="border-t border-rule pt-2">
              <p className="text-ink">{b.ask} <span className="font-mono text-ink-3">({b.version}, rule {b.rule})</span>{b.note ? `: ${b.note}` : ""} <span className="font-semibold">Under rules v2 and v3: {b.underV2}.</span>{(b as { v2Note?: string }).v2Note ? ` ${(b as { v2Note?: string }).v2Note}` : ""}</p>
              {b.failures.map((f) => (
                <p key={f.where} className="mt-1">&ldquo;{forDisplay(f.text)}&rdquo; <span className="font-mono text-ink-3">(cited step {f.steps.join(", ")})</span>: {f.reasons.map((r) => forDisplay(r)).join("; ")}.</p>
              ))}
            </li>
          ))}
        </ul>
        <p className="mt-2 max-w-copy text-sm text-ink-2">Until Oct 15 the fixes went into the tools and the prompt, never into the check: the tools now name both sides of the split and state the method&apos;s own numbers, and the score-binding rule was narrowed to the clause right after a brand. Recovered from the cache by scripts/blocked-extract.ts.</p>
      </section>

      <section className="mt-section max-w-copy">
        <h2 className="font-display text-xl">Overlap, not swaps</h2>
        <p className="mt-3 text-base text-ink-2">
          Measured Oct 13 on the twelve briefs above, after the protocol, so not held out. Each top name scored the others. A three with at least 0.05 less overlap existed in 6 of 12 briefs, but every one gave up more than 0.05 of fit with the seed, and two dropped the strongest name (Liquid Death would trade Death Wish Coffee, 0.83, for Nike, 0.67). So the reveal never suggests a swap. It only names a pair of top names whose audiences sit 0.05 or more closer to each other than any other pair: REI and Patagonia for Mt. Joy (0.97, next 0.89), and 5 of 11 briefs that ran.
        </p>
      </section>

      <section id="probes" className="mt-section max-w-copy scroll-mt-4">
        <h2 className="font-display text-xl">Rivals and the collision map</h2>
        <p className="mt-3 text-base text-ink-2">Measured Oct 11 on the hackathon API (probe/VERIFY-4.md and the build reports). These are limits of the front door, not held-out results.</p>
        <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 text-base text-ink">
          <li>
            <span className="font-semibold">Chelsea vs Arsenal fails both pass marks.</span> Of 60 brands in the two top-50 lists, 6 lean Chelsea, none lean Arsenal and 54 are shared, and the two maps share 9 of their top 10 US metros. To Qloo, two Premier League clubs read as one US audience, so the pair isn&apos;t offered. The other three test pairs passed both gates.
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
            <span className="font-semibold">An age bracket doesn&apos;t split the map.</span> Run real Oct 12, before anything was built (8 calls, scripts/age-probe.ts). At 24 and under, every drawn cell reads &ldquo;both&rdquo; (Olipop vs Poppi 1,500 of 1,500; Liquid Death vs Celsius 1,485). At 55 and over, a slight lean. No leaned cell flips between the brackets, against a pass mark of 15 in 100, and about 40 of the 1,500 hottest cells are shared between them. An age-bracketed heatmap shows where that bracket lives, not where the two brands part, so the map stays national.
          </li>
          <li>
            <span className="font-semibold">An audience segment doesn&apos;t reorder the eight.</span> Run real Oct 14 (about 8 calls, scripts/audience-probe.ts), pass mark set first: for each seed it probed, some Qloo audience must change the top three and move a name by two ranks. Under &ldquo;Parents With Young Children&rdquo; and &ldquo;Vintage Apparel&rdquo; every one of Allbirds&apos; and Mt. Joy&apos;s eight dropped by the same amount (0.06) and kept its order, and the two segments returned identical numbers. On this key the audience signal reads as a flat discount, not a lens, so no audience step was built.
          </li>
          <li>
            <span className="font-semibold">Where a candidate leads doesn&apos;t separate the eight.</span> Run real Oct 15 (8 calls, scripts/markets-probe.ts), pass mark set first: two of Allbirds&apos; eight must differ from Allbirds&apos; top five metros in two or more, and one of the agent&apos;s three must have an Outdoor Voices city in its top five. It passed on paper (8 of 8; Warby Parker and ClassPass have Austin), but each brand&apos;s top five sits inside a tie, so the difference is tie-break order:
            <table className="mt-2 text-sm">
              <thead><tr className="text-left text-ink-3"><th className="pr-6 font-normal">Brand</th><th className="font-normal">Metros within a point of its fifth</th></tr></thead>
              <tbody>
                {MARKET_TIES.map(([b, n]) => <tr key={b}><td className="pr-6">{b}</td><td className="tabular-nums">{n}</td></tr>)}
              </tbody>
            </table>
            <span className="mt-2 block">Warby Parker &ldquo;leading in Austin&rdquo; is one of 26 metros at the same score, and Allbirds scores Austin the same as its own top four. The split map&apos;s own diff was tried too, candidate against Allbirds at 0 calls (scripts/lean-probe.ts): 1,375 to 1,487 of the 1,500 drawn cells read &ldquo;both&rdquo;, and none of the three leans its way in a metro outside Allbirds&apos; top eight except a single Dallas cell. So no market column and no rings for the first call.</span>
          </li>
          <li id="judge-names" className="scroll-mt-4">
            <span className="font-semibold">Six names a judge might type, run before you do.</span> Real Oct 15 on the live site (scripts/judge-names.ts, about 92 calls), names and pass mark written first: four of six return a checked answer cold in under 45 seconds with none blocked, and each first call sits outside the seed&apos;s own field. <span className="font-semibold">It fails.</span> Four came back checked in time, but one was blocked and two first calls sit in the seed&apos;s own field as a reader would put it.
            <div className="mt-2 overflow-x-auto">
              <table className="text-sm">
                <thead><tr className="text-left text-ink-3"><th className="pr-4 font-normal">Typed</th><th className="pr-4 font-normal">Rival</th><th className="pr-4 font-normal">Seconds</th><th className="pr-4 font-normal">Calls</th><th className="pr-4 font-normal">Answer</th><th className="font-normal">The agent&apos;s three</th></tr></thead>
                <tbody>
                  {judgeNames.rows.map((r) => {
                    const f = (r as { followUp?: { secs: number; calls: number; check: string; calls3: string[]; rival: string } }).followUp;
                    return (
                      <tr key={r.name} className="align-top">
                        <td className="pr-4">{r.name}{f ? " (asked which one; brand picked)" : ""}</td>
                        <td className="pr-4">{(f?.rival ?? r.rival).replace(/ by .*/, "")}</td>
                        <td className="pr-4 tabular-nums">{r.cached ? "cached" : f ? `${r.secs} + ${f.secs}` : r.secs}</td>
                        <td className="pr-4 tabular-nums">{f ? r.calls! + f.calls : r.calls}</td>
                        <td className="pr-4">{f?.check ?? r.check}</td>
                        <td>{(f?.calls3 ?? r.calls3).join(", ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <span className="mt-2 block">What it shows. The Dodgers&apos; three are NFL teams and Chipotle&apos;s include MOD Pizza: the own-field cut is a shared genre tag, and baseball and football carry different ones, while Chipotle carries none, so neither cut caught a reader&apos;s idea of the same field. PlayStation&apos;s three (Twitch, Electronic Arts, Razer) sit outside its genre tag and inside gaming. Noah Kahan&apos;s answer was blocked by the checker on a sentence that was right (&ldquo;Little Words Project sits in a lower fame band with popularity 0.69, against 0.95 to 0.99 for the others&rdquo;): it bound a range to the first brand named. The rule was refined the same day and the answer now shows; see the blocked list above. Cedric the Entertainer replayed from an earlier cold run and his three are carmakers, the fame-saturated case. Calm asked which one first, as it should.</span>
          </li>
          <li>
            <span className="font-semibold">When Qloo fails mid-ask.</span> Drilled real Oct 15 on a local build with forced faults (lib/force.ts, development only). A Qloo 503 on the fourth call stopped Hoka after two steps; the page kept them, the unanswered step said Qloo didn&apos;t answer it, and the message said so. The retry reused the three answered calls and finished. A 12-second stall on Oatly&apos;s fourth call: the page kept its steps and kept measuring, and the answer arrived at 70 seconds. At the daily cap the page keeps its steps and says the allowance is used.
          </li>
          <li>
            <span className="font-semibold">Agent or pipeline: the routes, counted.</span> Across 39 cached asks, counted Oct 15, the agent took 5 distinct routes; 3 stopped at the name, before a call (scripts/routes.ts reads them from the cache, 0 calls). The order of tools is set in its instructions, and the branches follow what Qloo returned: whether it knew the name, whether a rival came back, and whether the split left enough names. 18 went through the split, 13 had no rival and used the fans&apos; top 50, 4 widened from a thin split, and 1 is the replay case. Each step on an ask now says where it forked.
          </li>
          <li id="both-ways" className="scroll-mt-4">
            <span className="font-semibold">On two of the three asks we probed, the other direction separates the agent&apos;s three.</span> Run real Oct 15 (18 calls, scripts/reverse-probe.ts), pass mark set first: the agent&apos;s three must sit 5 or more places apart on the seed&apos;s rank among each one&apos;s own fans&apos; top 50, and that order must differ from the taste order. Two of three asks pass, and the page now shows the table under &ldquo;Call first&rdquo;; it never reorders the agent&apos;s calls. <a href="#reverse-replay" className={linkInline}>Across 23 real deals it mostly can&apos;t be measured; see the reverse replay</a>.
            <div className="mt-2 overflow-x-auto"><table className="text-sm">
              <thead><tr className="text-left text-ink-3"><th className="pr-6 font-normal">Ask</th><th className="pr-6 font-normal">The agent&apos;s three rank the seed</th><th className="pr-6 font-normal">The rest</th><th className="font-normal">Gate</th></tr></thead>
              <tbody>
                {REVERSE_RANKS.map(([a, three, rest, ok]) => <tr key={a}><td className="pr-6">{a}</td><td className="pr-6 tabular-nums">{three}</td><td className="pr-6 tabular-nums">{rest}</td><td>{ok ? "passes" : "fails, no table shown"}</td></tr>)}
              </tbody>
            </table></div>
          </li>
          <li>
            <span className="font-semibold">A typed aisle can&apos;t ship honestly.</span> Probe run real Oct 12 (9 calls, scripts/aisle-probe.ts): Qloo&apos;s brand tag that best matches a typed category, then its top twelve brands. Running shoes, hard seltzer and skincare gave lists a partnerships lead would recognise. &ldquo;Streaming services&rdquo; matched &ldquo;Financial Services&rdquo; and returned banks, and &ldquo;fast-casual burgers&rdquo; matched no tag at all: 3 of 5 against a pass mark of 4. A word match that confidently shows the wrong aisle is the reason the three aisles stay prepared.
          </li>
          <li>
            <span className="font-semibold">A brand&apos;s footprint decides an aisle map, so the leaders map uses three.</span> Run real Oct 12 on cached heatmaps (scripts/leaders-probe.ts), pass mark: no brand above its share limit, and most coloured cells agreeing with their neighbours. All nine energy brands, each ranked within its own cells: Red Bull leads 2,880 of 6,134 coloured cells, because its map has 11,060 cells and 5-hour Energy&apos;s 1,235, so a small map can&apos;t lead where it has no reading (4,134 of 5,923 cells agree with their neighbours; fails the share limit of two in five). Ranked within the 1,208 cells all nine carry: the largest share is Red Bull&apos;s 195 of 1,053 coloured cells, but only 491 of 870 agree with their neighbours. The top four by cell count (Red Bull, Monster, Bang, Rockstar; 7,018 shared cells): Bang leads 1,953 of 4,834 and 3,440 of 4,587 agree, but Celsius drops out. The camp heads (Red Bull, Monster, Celsius; 3,957 shared cells, all of Celsius&apos;s map): Celsius leads 1,241 of 2,878, and 2,123 of 2,650 agree. The shipped rule: three camp heads per aisle, ranked within the cells all three carry, a pass mark of at least 3,000 shared cells, no brand above half the coloured cells, and at least three in five agreeing with their neighbours. Soda passes with Olipop, LaCroix and Simply Pop (4,681 cells; LaCroix leads 1,205 of 2,922; 2,141 of 2,734 agree; Poppi shares only 1,961). Outdoor fails on regions (Patagonia, The North Face, REI: 11,240 cells; Patagonia leads 2,242 of 6,364; only 3,485 of 6,170 agree) and has no leaders map.
          </li>
          {/* moonshots round 4, real Oct 18: the popularity cap gate passed, built as the smaller-names block */}
          <li id="smaller-names">
            <span className="font-semibold">A popularity cap keeps the fit, so the answer page shows smaller names.</span> Real Oct 18 (12 of 54 calls that day). Four seeds (Liquid Death, Olipop, Celsius, Allbirds), Qloo&apos;s brand list for each read three ways: as is, and with filter.popularity.max at 0.7 and 0.5. Pass mark, written before the run: affinity has to be the same number for the same brand in every read, or no comparison across reads means anything (it was, for every brand that appeared in two reads); and for three of the four seeds, at least five brands under the 0.7 cap with the strongest of them scoring at least four fifths of the leader&apos;s affinity (all four did: every capped list had 20 brands, and the strongest kept 0.98 or more of the leader&apos;s score). Passed. The block on the answer page uses the 0.5 cap and the product&apos;s own 0.05 tie rule, both chosen after the run. Two things the run showed: Qloo gives some brands popularity 0, which is no measurement, so they pass any cap untested and are left out; and Olipop&apos;s capped list is mostly those unmeasured brands, so it shows little. The measured file stays private under Qloo&apos;s terms.
          </li>
          {/* moonshots round 4, real Oct 18: the audience lens gate failed, published as found */}
          <li id="audience-lens">
            <span className="font-semibold">Qloo&apos;s named audiences barely separate partners, so there is no audience lens.</span> Real Oct 18 (about 40 of 54 calls that day). Four seeds (Liquid Death, Olipop, Celsius, Allbirds), each with its top three brand partners, scored under eight Qloo audiences (Single, Parents With Young Children, Technology Enthusiast, Discount Shoppers, Running, Travel, Foodie, Music Festivals) with signal.demographics.audiences and the four ids in filter.results.entities. Pass mark, written before the run: most of the twelve partners spread at least 0.10 between their highest and lowest audience, and not the same top audience everywhere. 3 of 12 spread 0.10 or more (the largest 0.111); Foodie tops 6 of 12; Olipop, its three partners, Celsius and Fallen Footwear return 0.76 under every audience, which reads as a value with nothing behind it. Failed, not built. The measured file stays private under Qloo&apos;s terms; the script is scripts/audience-probe.ts.
          </li>
          {/* Fable's Oct 16 ruling, pick 1: below the floor of 5 it is a probe entry, not a v3 line */}
          <li id="fresh-deals">
            <span className="font-semibold">Fresh deals, chosen by rule, didn&apos;t reach the floor.</span> Real Oct 16 (34 calls, no affinity read), a third replay on deals chosen by rule after the protocol froze (ef1c2d5, Oct 13). The rule was committed before the search (7563d08: Marketing Dive and Food Dive, Aug 17 to Oct 16, two brands per deal, a floor of 5 scored cases) and the list before any Qloo call (f077437). 13 deals found; 3 excluded under the rule (Netflix and Wendy&apos;s were already used, Papa Johns&apos; partner was a film). Of the 10 left, 5 names didn&apos;t confirm (BeatBox, Biscoff and Flamin&apos; Hot matched more than one entity; BuzzBallz, Mike&apos;s Hot Honey and Pilgrim&apos;s matched none), and Realtree and Skippy carry no brand genre tag, so no decoys can be drawn. 3 built (Hoka x Strava, Shock Top x Spirit Halloween, e.l.f. Cosmetics x Zepeto) against a floor of 5, so nothing was scored and there is no third replay line. Most of the losses are small food and drink brands, as in the notes on the API below. Both sites&apos; listing pages wouldn&apos;t paginate, so the search rests on 26 domain-restricted web searches plus the first page of each listing (log in audit/replay-v3-search-log.md). Files: audit/replay-v3-protocol.md, replay-v3-cases.json and replay-v3-search.json; the scored file stays private under Qloo&apos;s terms.
          </li>
        </ul>
      </section>

      <section className="mt-section">
        <details>
          <summary className="cursor-pointer font-display text-xl">Dev briefs (the rules were tuned on these)</summary>
          <ol className="mt-4 grid gap-6 md:grid-cols-2">
            {dev.map((b) => (
              <BriefCard key={b.seed} b={b} />
            ))}
          </ol>
        </details>
      </section>

      {/* Fable's Oct 16 ruling, pick 3: what we asked, what came back, what we shipped, the probe file. No adjectives, no asks. */}
      <section id="api-notes" className="mt-section max-w-copy scroll-mt-4">
        <h2 className="font-display text-xl">Notes on the API</h2>
        <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 text-base text-ink">
          {API_NOTES.map(([asked, came, shipped, file]) => (
            <li key={file}>{asked} {came} Shipped: {shipped} <span className="text-ink-3">({file})</span></li>
          ))}
        </ul>
      </section>

      <section className="mt-section max-w-copy border-t border-rule pt-6 text-sm text-ink-3">
        <p>What this doesn&apos;t establish: purchases, visits, commercial eligibility, or whether a deal makes money.</p>
        <p className="mt-2">
          Method: brand names resolved brand-only; buyer gates come from each brief and are examples, not facts about the companies. Affinities are rounded to two decimals; Qloo&apos;s raw responses aren&apos;t published. Protocol and rules: audit/briefs.json, lib/review.ts. Run {results.ranAt}.
        </p>
      </section>
    </main>
  );
}

const API_NOTES: [string, string, string, string][] = [
  ["Ten small food, drink and beauty brands searched by name, Oct 8.", "None came back as itself; search returned another brand (Fruition Chocolate Works as Bath & Body Works).", "every name is confirmed before a call, and an unknown name stops the ask.", "probe run Oct 8, probe/out"],
  ["Twenty-four typed names resolved, Oct 10.", "Corona, Mars, Ghost and Prime confirmed to an entity of another type that Qloo listed first.", "an exact name that another type also carries asks which one.", "scripts/audit-run.ts"],
  ["Five category words matched to brand tags, Oct 12.", "“Streaming services” matched Financial Services and returned banks; “fast-casual burgers” matched no tag.", "the three aisles stay prepared; no typed aisle.", "scripts/aisle-probe.ts"],
  ["Olipop scored against six brands in both directions.", "The reverse values were identical to the forward ones.", "the other direction is read as a rank among each brand’s own fans’ top 50, never as a second score.", "probe/VERIFY-3.md, scripts/reverse-probe.ts"],
  ["Top five metros for each of Allbirds’ eight, Oct 15.", "Each top five sits inside a tie within a point of its fifth.", "no card names a call and a place together.", "scripts/markets-probe.ts"],
  ["Genre tags for nine test brands, Oct 11.", "Olipop, Erewhon and A24 carry no brand genre tag among 98 to 114 tags each.", "the rival finder falls back to Qloo’s product category.", "lib/rival.ts, probe/VERIFY-4.md"],
];

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
    <li className={`${panel} p-4`}>
      <h3 className="text-lg font-semibold">{b.seed}</h3>
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
                  {x.name} <span className="text-sm tabular-nums text-ink-3">{x.affinity?.toFixed(2)}</span> {x.role && <span className="text-xs text-ink-2">{x.role === "ambiguous" ? "ambiguous name" : x.role}</span>}
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

// Historical replay: two frozen tests, each published as run, pass or fail (audit/replay-protocol.md, replay-v1;
// audit/replay-v2-protocol.md, replay-v2, new cases only after v1 missed). Pooled numbers are labelled after the fact.
type ReplayFile = typeof replay | typeof replayV2;
function Replay() {
  const [a, b] = [replay.summary!, replayV2.summary!];
  return (
    <section id="replays" className="mt-section scroll-mt-4">
      <h2 className="font-display text-xl">Would it have found real partners?</h2>
      <StripImage className="mt-4" />
      <p className="mt-3 max-w-copy text-base text-ink-2">
        Real brand collaborations, each with a public source. For each, the real partner sits among seven decoys from its own Qloo category and fame band, chosen by rule with no taste score read; then the seed&apos;s fans (the brand that made the deal) score all eight. A hit is the real partner in the top three; chance is three in eight. Each test&apos;s protocol and bar were frozen in git before it ran.
      </p>
      {/* W5b: the controls before any per-test pass line, and the two tests folded under them, so no passing number is
          read without the controls that undo it */}
      <ReplayControls />
      <details className="mt-6">
        <summary className="cursor-pointer text-base text-ink-2">The two tests case by case: the first reading, before the controls</summary>
      <ReplayRun data={replayV2} freeze={REPLAY_V2_FREEZE} title="Second test (v2): new cases only, after the first missed" protocol="audit/replay-v2-protocol.md"
        dropped="Ten dropped under the written decoy check: nine had the partner's own parent or a sister brand among the decoys, and Pandora matched the jewelry brand, not the music service."
        note="Sensitivity: two kept cases (Krispy Kreme x Crocs, Pringles x Crocs) have luxury-house decoys the rules don't cover; both were hits. Without them it is 9 of 12, against a bar of 8 for twelve."
        control />
      <ReplayRun data={replay} freeze={REPLAY_FREEZE} title="First test (v1)" protocol="audit/replay-protocol.md"
        dropped="Four had no Qloo category tag for the partner; four had a tag that isn't the partner's category. Red Bull x GoPro and Liquid Death x e.l.f. were left out because their scores were already seen." />
      <p className="mt-6 max-w-copy text-sm text-ink-2">
        Pooled after the fact, not a test: {a.hits + b.hits} of {a.scored + b.scored} real partners in the top three across both. A deal that happened is a decision, not proof it worked.
      </p>
      </details>
    </section>
  );
}

// Binomial tail: a real partner lands in the top three of eight by chance with p = 3/8. 11 of 14 is about 1 in 469.
function chanceAtLeast(n: number, k: number, p = 3 / 8) {
  const choose = (a: number, b: number) => { let r = 1; for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i; return r; };
  let s = 0;
  for (let i = k; i <= n; i++) s += choose(n, i) * p ** i * (1 - p) ** (n - i);
  return s;
}

function ReplayRun({ data, freeze, title, protocol, dropped, note, control }: { data: ReplayFile; freeze: string; title: string; protocol: string; dropped: string; note?: string; control?: boolean }) {
  const sum = data.summary!;
  const scored = data.cases.filter((c) => c.result?.state === "scored");
  const out = data.cases.filter((c) => c.dropped);
  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-copy text-lg text-ink">
        {sum.pass ? "It passes" : "It fails its bar"}: {sum.hits} of {sum.scored} real partners in the top three (needed {sum.need}; chance gives about {((sum.scored * 3) / 8).toFixed(1)}, and {sum.hits} or more by chance is about 1 in {Math.round(1 / chanceAtLeast(sum.scored, sum.hits))}). No real partner ranked below {Math.max(...scored.map((c) => c.result!.rank!))}th, and the mean rank is {sum.meanRank} against {sum.chanceMeanRank} by chance, reported but not part of the bar.{control && <> <a href="#replay-controls" className={linkInline}>Read it with the replay controls above</a>.</>}
      </p>
      <p className="mt-1 text-sm text-ink-3">Frozen at commit <code className="font-mono">{freeze}</code> ({protocol}).</p>
      <ul className="mt-3 grid max-w-[900px] gap-x-8 md:grid-cols-2">
        {scored.map((c) => (
          <li key={c.seed + c.partner} className="border-t border-rule py-3 text-sm text-ink-2">
            <p className="text-base text-ink">
              {c.seed} x {c.partner} <span className="text-ink-3">({c.year})</span>: <span className="tabular-nums">#{c.result!.rank} of {c.result!.of}</span>
            </p>
            <p className="mt-1 tabular-nums">
              {c.result!.affinity!.toFixed(2)} against a top of {c.result!.top!.toFixed(2)}. Decoys: {c.decoys!.map((d) => d.name).join(", ")}.{" "}
              <a href={c.source} className={linkInline}>Source</a>
            </p>
            {`${c.seed} x ${c.partner}` === replayAsk.case && (
              <p className="mt-1">
                Replayed as an ask for the video, chosen before the run; a demonstration, not a test. Protocol rank #{replayAsk.protocolRank}; the agent, given the eight in alphabetical order without knowing which was real, called {c.partner} {replayAsk.agentCall}.{" "}
                <Link href={replayAsk.href} className={linkInline}>Open the ask</Link>
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-copy text-sm text-ink-2">Dropped before scoring: {out.map((c) => `${c.seed} x ${c.partner}`).join("; ")}. {dropped}</p>
      {note && <p className="mt-2 max-w-copy text-sm text-ink-2">{note}</p>}
    </div>
  );
}
