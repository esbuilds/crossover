/* eslint-disable @next/next/no-img-element -- Qloo images are remote and already sized; next/image adds config for nothing */
import type { Card } from "@/lib/slate.ts";
import Link from "next/link";
// Shared pieces of the design system (tokens live in globals.css). One primary button per screen.
export const btnPrimary =
  "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-accent px-5 text-base font-medium text-white hover:bg-accent-strong disabled:opacity-50";
export const btnSecondary =
  "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-rule-strong bg-surface px-4 text-base text-ink hover:border-ink disabled:opacity-50";
export const btnQuiet =
  "inline-flex min-h-11 items-center text-base text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink hover:decoration-ink disabled:opacity-50";
export const field =
  "min-h-11 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink placeholder:text-ink-3 outline-none focus:border-ink";
export const panel = "rounded-lg border border-rule bg-surface";

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
  oneway: "One way",
  competitor: "Competitor",
  excluded: "Excluded by constraint",
  lower: "Ranked lower",
  approved: "Approved",
  declined: "Declined",
};

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
      <Thumb src={card.image} name={card.name} className="h-14 w-14 rounded-md" />
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

export function Thumb({ src, name, className }: { src?: string; name: string; className: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${className} shrink-0 bg-surface-2 object-cover`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center bg-surface-2 font-display text-xl text-ink-3`}>{name.slice(0, 1)}</div>
  );
}


// Wordmark left, one quiet link right. Same on every page.
export function SiteHeader({ href, label }: { href: string; label: string }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-rule py-3">
      <Link href="/" className="inline-flex min-h-11 items-center font-display text-xl">
        Crossover
      </Link>
      <Link href={href} className={btnQuiet}>
        {label}
      </Link>
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
export function ExampleLinks() {
  return (
    <span className="flex flex-wrap items-center gap-x-4">
      <span className="text-ink-2">Try:</span>
      {EXAMPLES.map((e) => (
        <a key={e.name} href={e.href} className={btnQuiet}>
          {e.name}
        </a>
      ))}
    </span>
  );
}
