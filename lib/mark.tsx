// The mark (Oct 24): two names trading rank, the crossing in the ask's slopegraph. Ink line and accent line.
// Hex rather than the theme tokens so next/og cards (satori) can draw the same component; #bd4510 is --color-accent.
// app/icon.svg is the same drawing on a white tile; keep them in step.
export function Mark({ size, ink = "#1b1716" }: { size: number; ink?: string }) {
  const accent = "#bd4510";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 9 26 23" stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
      <path d="M6 23 26 9" stroke={accent} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={6} cy={9} r={3.6} fill={ink} />
      <circle cx={26} cy={23} r={3.6} fill={ink} />
      <circle cx={6} cy={23} r={3.6} fill={accent} />
      <circle cx={26} cy={9} r={3.6} fill={accent} />
    </svg>
  );
}
