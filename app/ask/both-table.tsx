// The "both ways" table (Fable's columns ruling, real Oct 15): all eight rows in the frozen review's order, the agent's
// calls marked, both ranks, one static caption. Shared by the ask page and the sheet; no hooks.
import Link from "next/link";
import { linkInline } from "@/app/ui";
import { cell as show, slope, SLOPE, type BothWays } from "@/lib/ask/both-rules.ts";

export function BothTable({ b, compact = false }: { b: BothWays; compact?: boolean }) {
  // DC F14: rows top-aligned and the ranks kept on one line, so a phone wraps the long name instead of every "not in their top 50"
  const cell = `align-top ${compact ? "py-0 pr-4" : "py-1 pr-6"}`;
  // persona round 2 (Olipop lead): a withheld table said nothing; now one line says why
  if (!b.shown)
    return (
      <p className={compact ? "mt-1.5 text-ink-2" : "mt-3 max-w-copy text-sm text-ink-3"}>
        The other direction (each one&apos;s fans&apos; rank of {b.seed}) was measured and doesn&apos;t separate these {b.rows.length}, so there&apos;s no table.{" "}
        {compact ? "The rule is on /audit." : <Link href="/audit#both-ways" className={linkInline}>How that&apos;s decided</Link>}
      </p>
    );
  return (
    <div className={compact ? "mt-2" : "mt-4"}>
      {b.sentence && <p className={compact ? "font-semibold" : "text-lg text-ink"}>{b.sentence}</p>}
      {b.oneWay && <p className={compact ? "font-semibold" : "text-lg text-ink"}>{b.oneWay}</p>}
      <table className={`${compact ? "text-[1em]" : "mt-2 text-sm"} tabular-nums`}>
        <thead>
          <tr className="text-left text-ink-3">
            <th className={`${cell} font-normal`}>The eight</th>
            <th className={`${cell} font-normal`}>{b.seed} fans rank it</th>
            <th className={`${cell} font-normal`}>Its fans rank {b.seed}</th>
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r) => (
            <tr key={r.name} className={r.call ? "text-ink" : "text-ink-2"}>
              <td className={`${cell} sm:whitespace-nowrap`}>{r.call ? <span className="font-semibold">{r.name} *</span> : r.name}</td>
              <td className={`${cell} whitespace-nowrap`}>{show(r.fwd)}</td>
              <td className={`${cell} whitespace-nowrap`}>{show(r.rev)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`${compact ? "text-[0.95em]" : "mt-2 max-w-copy text-sm"} text-ink-3`}>
        * the agent&apos;s calls. The first column is the taste score&apos;s own order, so it restates the tie. The second is that brand&apos;s fans&apos; own top 50 {b.noun}, a different list.
      </p>
    </div>
  );
}

// The same rows as a slopegraph (SPECTACLE-2, real Oct 22): left, the seed's fans' rank of each; right, each one's fans'
// rank of the seed. A line that climbs is drawn in the accent. Every label is a table cell (lib/ask/both-rules.ts
// slope), and the table on the page carries the same ranks for screen readers.
export function BothSlope({ b }: { b: BothWays }) {
  const s = slope(b);
  if (!s) return null;
  const { top, h } = SLOPE;
  const { w, l, r } = s;
  const head = (x: number, anchor: "start" | "end", a: string, c: string) => (
    <text x={x} y={12} textAnchor={anchor} className="fill-ink-3"><tspan x={x}>{a}</tspan><tspan x={x} dy={16}>{c}</tspan></text>
  );
  return (
    <svg viewBox={`0 0 ${w} ${s.height}`} className="mt-4 w-full max-w-md text-[13px]" aria-hidden="true">
      {head(l, "end", `${b.seed} fans`, "rank it")}
      {head(r, "start", "Its fans rank", b.seed)}
      <line x1={l} x2={l} y1={top - 6} y2={top + h} className="stroke-rule-ui" />
      <line x1={r} x2={r} y1={top - 6} y2={top + h} className="stroke-rule-ui" />
      {s.rows.map((x) => {
        const tone = x.climbs ? "stroke-accent" : "stroke-ink-3";
        return (
          <g key={x.name}>
            <line x1={l} y1={x.y1} x2={r} y2={x.y2} strokeWidth={x.climbs ? 2.5 : 1} className={tone} />
            <circle cx={l} cy={x.y1} r={3} className={x.climbs ? "fill-accent" : "fill-ink-3"} />
            <circle cx={r} cy={x.y2} r={3} strokeWidth={1.25} className={x.out ? "fill-surface stroke-ink-3" : x.climbs ? "fill-accent" : "fill-ink-3"} />
            <line x1={l - 12} y1={x.ly1} x2={l - 4} y2={x.y1} className="stroke-rule-ui" />
            <text x={l - 14} y={x.ly1 + 4} textAnchor="end" className={x.climbs || x.call ? "fill-ink" : "fill-ink-2"}>{x.name} <tspan className={x.climbs ? "fill-accent-strong font-semibold" : "fill-ink-3"}>{x.left}</tspan></text>
            {x.right && <line x1={r + 4} y1={x.y2} x2={r + 12} y2={x.ly2} className="stroke-rule-ui" />}
            {x.right && <text x={r + 14} y={x.ly2 + 4} className={x.climbs ? "fill-accent-strong font-semibold" : "fill-ink-2"}>{x.right}</text>}
          </g>
        );
      })}
    </svg>
  );
}
