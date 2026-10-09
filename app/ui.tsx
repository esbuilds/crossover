// Shared pieces of the design system (tokens live in globals.css). One primary button per screen.
export const btnPrimary =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-accent px-5 text-base font-medium text-white hover:bg-accent-strong disabled:opacity-50";
export const btnSecondary =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-rule-strong bg-surface px-4 text-base text-ink hover:border-ink disabled:opacity-50";
export const btnQuiet =
  "inline-flex min-h-11 items-center text-base text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink hover:decoration-ink disabled:opacity-50";
export const field =
  "min-h-11 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-3 text-base text-ink placeholder:text-ink-3 outline-none focus:border-ink";
export const panel = "rounded-lg border border-rule bg-surface";

// The one chip system: status on a pick or a market. Text always says what the color means.
export type ChipKind = "mutual" | "partial" | "competitor" | "excluded" | "lower" | "approved" | "note";
const CHIP: Record<ChipKind, string> = {
  mutual: "bg-accent-tint text-accent-strong",
  partial: "border border-rule-strong text-ink-2",
  competitor: "bg-surface-2 text-ink-2 border border-rule",
  excluded: "bg-surface-2 text-ink-2 border border-rule",
  lower: "bg-surface-2 text-ink-2 border border-rule",
  approved: "bg-success-tint text-success",
  note: "text-ink-2 border border-rule",
};
export const CHIP_LABEL: Partial<Record<ChipKind, string>> = {
  mutual: "Mutual",
  partial: "Partial",
  competitor: "Competitor",
  excluded: "Excluded by constraint",
  lower: "Ranked lower",
  approved: "Approved",
};

export function Chip({ kind, title, children }: { kind: ChipKind; title?: string; children?: React.ReactNode }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-medium ${CHIP[kind]}`}>
      {children ?? CHIP_LABEL[kind]}
    </span>
  );
}
