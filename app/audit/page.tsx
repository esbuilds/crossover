import type { Metadata } from "next";
import results from "@/audit/results.json";
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
        Roles like &ldquo;famous&rdquo; and &ldquo;small&rdquo; were written into the briefs before any run, as the drafter&apos;s expectation for coverage. They are not labels of truth, and a real past deal isn&apos;t a positive label either. {unmeasured} of {names} held-out names couldn&apos;t be measured; they are listed, never scored.
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
