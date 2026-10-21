import type { Card } from "@/lib/slate.ts";
import Link from "next/link";
import NavLinks from "./nav-links";
// Shared pieces of the design system (tokens live in globals.css). One primary button per screen.
export const btnPrimary =
  "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-accent px-5 text-base font-medium text-white transition-[background-color,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-accent-strong active:translate-y-px disabled:cursor-wait disabled:bg-ink-3 motion-reduce:active:translate-y-0";
export const btnSecondary =
  "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-rule-ui bg-surface px-4 text-base text-ink transition-[border-color] duration-150 ease-out motion-reduce:transition-none hover:border-ink disabled:opacity-50";
// Three click styles (DC F2, CT F3): linkInline for links inside a sentence, btnText for actions and standalone links,
// chip for the rows of names to try. Underlines belong to linkInline only, until hover.
export const linkInline =
  "underline decoration-ink-3 underline-offset-4 transition-[color,text-decoration-color] duration-150 ease-out motion-reduce:transition-none hover:text-ink hover:decoration-ink";
export const btnText =
  "inline-flex min-h-11 items-center text-base font-medium text-ink decoration-ink-3 underline-offset-4 transition-[color,text-decoration-color] duration-150 ease-out motion-reduce:transition-none hover:underline disabled:text-ink-3 disabled:no-underline";
export const chip =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-rule px-3 py-1 text-sm text-ink transition-[border-color] duration-150 ease-out motion-reduce:transition-none hover:border-ink aria-[current=true]:border-ink disabled:text-ink-3";
export const field =
  "min-h-11 w-full min-w-0 rounded-md border border-rule-ui bg-surface px-3 text-base text-ink placeholder:text-ink-3 outline-none transition-[border-color] duration-150 ease-out motion-reduce:transition-none focus:border-ink";
// one card treatment (DC F9): panel for containers, panelStrong for the call card only (a firmer border, no tint)
export const panel = "rounded-md border border-rule bg-surface";
export const panelStrong = "rounded-md border border-rule-strong";
// The page shell (SPACE, real Oct 21): one width, a fluid gutter, and a full section of air before the colophon.
// Every route's <main> uses it; the title section under the header takes pt-page (globals.css has the scale).
export const shell = "mx-auto max-w-page px-gutter pb-section";

// The one chip system: status on a pick or a market. Text always says what the color means.
export type ChipKind = "mutual" | "partial" | "oneway" | "competitor" | "excluded" | "lower" | "approved" | "declined" | "note";
const CHIP: Record<ChipKind, string> = {
  mutual: "bg-accent-tint text-accent-strong",
  partial: "border border-rule-strong text-ink-2",
  oneway: "border border-rule text-ink-2",
  competitor: "bg-surface-2 text-ink-2 border border-rule",
  excluded: "bg-surface-2 text-ink-2 border border-rule",
  lower: "bg-surface-2 text-ink-2 border border-rule",
  approved: "bg-success-tint text-success",
  declined: "bg-danger-tint text-danger",
  note: "text-ink-2 border border-rule",
};
export const CHIP_LABEL: Partial<Record<ChipKind, string>> = {
  mutual: "Mutual",
  partial: "Partial",
  oneway: "In one top 50 only",
  competitor: "Competitor",
  excluded: "Excluded by constraint",
  lower: "Ranked lower",
  approved: "Approved",
  declined: "Declined",
};

// "Which one?": the one-click picker for a name with several Qloo matches (triage rows, triage seed, the review desk).
export function WhichOne<T>({ options, label, onPick, onNone, className = "" }: { options: T[]; label: (o: T) => string; onPick: (o: T) => void; onNone?: () => void; className?: string }) {
  return (
    <span className={`flex flex-wrap items-center gap-2 text-base ${className}`}>
      <span className="text-ink-2">Which one?</span>
      {options.map((o, i) => (
        <button key={i} type="button" onClick={() => onPick(o)} className={chip}>
          {label(o)}
        </button>
      ))}
      {onNone && (
        <button type="button" onClick={onNone} className={btnText}>
          None of these
        </button>
      )}
    </span>
  );
}

export function Chip({ kind, title, children }: { kind: ChipKind; title?: string; children?: React.ReactNode }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-medium ${CHIP[kind]}`}>
      {children ?? CHIP_LABEL[kind]}
    </span>
  );
}

export const TYPE_LABEL: Record<string, string> = {
  "urn:entity:brand": "Brand",
  "urn:entity:artist": "Artist",
  "urn:entity:tv_show": "TV show",
  "urn:entity:movie": "Film",
  "urn:entity:person": "Person",
  proxy: "Brand, not in Qloo yet",
};

// The small confirmation of who the slate is for. Also the picker's option and the proxy run's header.
export function MatchCard({ card, onNotIt }: { card: Card; onNotIt?: () => void }) {
  return (
    <div className={`${panel} flex items-center gap-4 p-3 sm:p-4`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-3">{TYPE_LABEL[card.type] ?? "Entity"}</p>
        <h2 className="truncate font-display text-xl">{card.name}</h2>
        {card.short_description && <p className="line-clamp-1 text-base text-ink-2">{card.short_description}</p>}
      </div>
      {onNotIt && (
        <button onClick={onNotIt} className={btnSecondary}>
          Not it
        </button>
      )}
    </div>
  );
}


// Wordmark left, the nav right. Same on every page.
// One nav on every page (Pick 1, Oct 14): ask, two names in, Pick three, the audit. The old per-page link (href, label)
// is ignored, so the routes cut from the nav (/map, /find, /pair, /triage, /s, /review, /end-card) keep their own code.
// Fable's ruling (Oct 15): the challenge takes Pick three's place; Pick three stays one click from every answer and the footer.
// The links live in NavLinks, a client component, because the current-page mark reads the path.
export function SiteHeader(props: { href?: string; label?: string }) {
  void props;
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 border-b border-rule py-3 sm:py-4">
      <Link href="/" className="inline-flex min-h-11 items-center font-display text-xl">
        Crossover
      </Link>
      <NavLinks />
    </header>
  );
}

// The four warm examples: home chips, and the way out of a calm failure (out of credit, daily cap).
export const EXAMPLES = [
  { name: "Liquid Death", note: "canned water", href: "/s/4DF7C265-52D9-4A99-8803-F62C2302D561?t=urn%3Aentity%3Abrand" },
  { name: "Olipop", note: "prebiotic soda", href: "/s/6647FB92-9390-4B58-885B-86D96FF5BB6D?t=urn%3Aentity%3Abrand" },
  { name: "Mt. Joy", note: "indie folk band", href: "/s/A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A?t=urn%3Aentity%3Aartist" },
  { name: "Somebody Feed Phil", note: "Netflix food show", href: "/s/02F34B14-E7B2-4AFA-B21E-AA9332CD9CC2?t=urn%3Aentity%3Atv_show" },
];
// More warm names for the home page's quiet "or try" row (Oct 25): all warmed, so they open instantly.
export const MORE_EXAMPLES = [
  { name: "Taylor Swift", href: "/s/4BBEF799-A0C4-4110-AB01-39216993C312?t=urn%3Aentity%3Aartist" },
  { name: "Stranger Things", href: "/s/07F1170E-BB69-4982-82C6-255F477EBBAD?t=urn%3Aentity%3Atv_show" },
  { name: "Chelsea FC", href: "/s/A21D248A-7379-458E-A3BE-7B8C4B961AF6?t=urn%3Aentity%3Abrand" },
  { name: "Live Nation", href: "/s/5F14EE21-73BC-4D7E-8349-75E24A250705?t=urn%3Aentity%3Abrand" },
  { name: "A24", href: "/s/7E904879-87BC-4BA6-B4AB-6E380A4C250D?t=urn%3Aentity%3Abrand" },
  { name: "Erewhon", href: "/s/E87E45A7-080F-4C6E-B1B2-B7BE3A80DCAE?t=urn%3Aentity%3Abrand" },
];
export function ExampleLinks() {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-ink-2">Try:</span>
      {EXAMPLES.map((e) => (
        <a key={e.name} href={e.href} className={chip}>
          {e.name}
        </a>
      ))}
    </span>
  );
}

// The judge path (Pick A, Oct 13), on every main page: the ask, the measurement behind any step, the audit.
export function JudgePath() {
  return (
    <p className="mt-2 text-sm text-ink-3">
      Three stops:{" "}
      <Link href="/" className={linkInline}>ask</Link> ·{" "}
      <Link href="/#steps" className={linkInline}>the evidence behind any step</Link> ·{" "}
      <Link href="/audit" className={linkInline}>is any of this right?</Link>
    </p>
  );
}
