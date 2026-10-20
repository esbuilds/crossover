// The "both ways" table (Fable's columns ruling, real Oct 15): all eight rows in the frozen review's order, the agent's
// calls marked, both ranks, one static caption. Shared by the ask page and the sheet; no hooks.
import Link from "next/link";
import { linkInline } from "@/app/ui";
import type { BothWays, Rank } from "@/lib/ask/both-rules.ts";

const th = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const show = (r: Rank) => (r === null ? "no measurement" : r === "out" ? "not in their top 50" : th(r));

export function BothTable({ b, compact = false }: { b: BothWays; compact?: boolean }) {
  const cell = compact ? "py-0 pr-4" : "py-1 pr-6";
  // persona round 2 (Olipop lead): a withheld table said nothing; now one line says why
  if (!b.shown)
    return (
      <p className={compact ? "mt-1.5 text-ink-2" : "mt-3 max-w-[60ch] text-sm text-ink-3"}>
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
              <td className={`${cell} whitespace-nowrap`}>{r.call ? <span className="font-semibold">{r.name} *</span> : r.name}</td>
              <td className={cell}>{show(r.fwd)}</td>
              <td className={cell}>{show(r.rev)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`${compact ? "text-[0.95em]" : "mt-2 max-w-[60ch] text-sm"} text-ink-3`}>
        * the agent&apos;s calls. The first column is the taste score&apos;s own order, so it restates the tie. The second is that brand&apos;s fans&apos; own top 50 {b.noun}, a different list.
      </p>
    </div>
  );
}
