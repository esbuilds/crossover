"use client";
import { useState } from "react";
import Link from "next/link";
import type { Constellation } from "@/lib/constellation.ts";
import { btnPrimary } from "@/app/ui";
import { edges, FONT, place } from "@/lib/constellation-layout.ts";

const BRAND = encodeURIComponent("urn:entity:brand");
const ACCENT = "#bd4510"; // --color-accent, as app/vs/collide TONE (SVG takes no CSS vars)
const INK2 = "#58514d";

function Plot({ c, W, H, picked, toggle, className }: { c: Constellation; W: number; H: number; picked: number[]; toggle: (i: number) => void; className: string }) {
  const placed = place(c, W, H, 28);
  const folded = placed.filter((p) => !p.label);
  const at = (i: number) => placed[i];
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-lg border border-rule bg-surface-2" role="group" aria-label={`${c.title}: brands placed by how much their audiences overlap in Qloo`}>
        {edges(c).map(([i, j, v]) => (
          <line key={`${i}-${j}`} x1={at(i).cx} y1={at(i).cy} x2={at(j).cx} y2={at(j).cy} stroke={INK2} strokeOpacity={0.15 + 0.6 * Math.min(1, Math.max(0, (v - 0.75) / 0.22))} strokeWidth={1 + 3 * Math.min(1, Math.max(0, (v - 0.75) / 0.22))} />
        ))}
        {picked.length === 2 && <line x1={at(picked[0]).cx} y1={at(picked[0]).cy} x2={at(picked[1]).cx} y2={at(picked[1]).cy} stroke={ACCENT} strokeWidth={2} strokeDasharray="4 4" />}
        {placed.map((p) => {
          const on = picked.includes(p.i);
          const n = folded.indexOf(p) + 1;
          return (
            <g
              key={p.i}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={c.dots[p.i].name}
              onClick={() => toggle(p.i)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(p.i))}
              className="cursor-pointer focus:outline-none [&:focus-visible>circle:first-child]:stroke-ink"
            >
              <circle cx={p.cx} cy={p.cy} r={Math.max(p.r, 22)} fill="transparent" strokeWidth={2} />
              <circle cx={p.cx} cy={p.cy} r={p.r} fill={on ? ACCENT : INK2} fillOpacity={on ? 1 : 0.75} />
              {p.label ? (
                <text x={p.label.x} y={p.label.y} textAnchor={p.label.anchor} fontSize={FONT} fill={on ? ACCENT : "#2b2522"} fontWeight={on ? 600 : 400}>
                  {c.dots[p.i].name}
                </text>
              ) : (
                <text x={p.cx + p.r + 3} y={p.cy - p.r + 2} fontSize={FONT} fontWeight={600} fill="#2b2522">
                  {n}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {folded.length > 0 && <p className="mt-2 text-sm text-ink-2">{folded.map((p, k) => `${k + 1} ${c.dots[p.i].name}`).join(" · ")}</p>}
    </div>
  );
}

export default function ConstellationView({ c }: { c: Constellation }) {
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].slice(-2)));
  // the link follows the category's order, not the click order: pair order is in the cache key, so either click lands warm
  const [a, b] = [...picked].sort((x, y) => x - y).map((i) => c.dots[i]);
  const aff = picked.length === 2 ? c.affinity[picked[0]][picked[1]] : null;
  return (
    <section className="mt-6">
      <Plot c={c} W={1000} H={500} picked={picked} toggle={toggle} className="max-sm:hidden" />
      <Plot c={c} W={360} H={540} picked={picked} toggle={toggle} className="sm:hidden" />
      <div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 text-base" aria-live="polite">
        {picked.length < 2 ? (
          <p className="text-ink-2">{picked.length === 0 ? "Click two brands to compare their audiences." : `${a.name}. Click one more.`}</p>
        ) : (
          <>
            <p className="text-ink">
              {a.name} and {b.name}: mutual affinity {aff === null ? "not measured" : aff.toFixed(2)}.
            </p>
            <Link href={`/vs/${a.id}/${b.id}?ta=${BRAND}&tb=${BRAND}`} prefetch={false} className={btnPrimary}>
              Open {a.name} vs {b.name}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
