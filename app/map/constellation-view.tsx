"use client";
import { useState } from "react";
import Link from "next/link";
import type { Constellation } from "@/lib/constellation.ts";
import { btnPrimary } from "@/app/ui";

const BRAND = encodeURIComponent("urn:entity:brand");
const FONT = 14;
const ACCENT = "#bd4510"; // --color-accent, as app/vs/collide TONE (SVG takes no CSS vars)
const INK2 = "#58514d";

type Placed = { i: number; cx: number; cy: number; r: number; label: { x: number; y: number; anchor: "start" | "end" | "middle" } | null };

// Fit the projection into the box at one scale for both axes (distances keep their meaning), then place labels:
// right, left, above, below, first that overlaps nothing; a label with no room folds to a number with a key.
// ponytail: greedy placement in popularity order; fine for 12 dots, use a force layout if categories grow.
function place(c: Constellation, W: number, H: number, pad: number): Placed[] {
  // on a tall box (phones) the projection's long axis runs down the screen: same distances, turned 90 degrees
  const turn = H > W;
  const xs = c.dots.map((d) => (turn ? d.y : d.x)), ys = c.dots.map((d) => (turn ? d.x : d.y));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
  const pts = c.dots.map((_, i) => ({ i, cx: ox + (xs[i] - x0) * k, cy: oy + (ys[i] - y0) * k, r: 6 + 10 * (c.dots[i].popularity ?? 0) }));
  type Box = [number, number, number, number];
  const boxes: Box[] = pts.map((p) => [p.cx - p.r, p.cy - p.r, p.cx + p.r, p.cy + p.r]);
  const hit = (b: Box) => b[0] < 0 || b[2] > W || b[1] < 0 || b[3] > H || boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const order = [...pts].sort((a, b) => (c.dots[b.i].popularity ?? 0) - (c.dots[a.i].popularity ?? 0));
  const out = new Map<number, Placed>();
  for (const p of order) {
    const w = c.dots[p.i].name.length * FONT * 0.56, g = 4;
    const tries: [Box, Placed["label"]][] = [
      [[p.cx + p.r + g, p.cy - FONT / 2, p.cx + p.r + g + w, p.cy + FONT / 2], { x: p.cx + p.r + g, y: p.cy + FONT * 0.35, anchor: "start" }],
      [[p.cx - p.r - g - w, p.cy - FONT / 2, p.cx - p.r - g, p.cy + FONT / 2], { x: p.cx - p.r - g, y: p.cy + FONT * 0.35, anchor: "end" }],
      [[p.cx - w / 2, p.cy - p.r - g - FONT, p.cx + w / 2, p.cy - p.r - g], { x: p.cx, y: p.cy - p.r - g - 2, anchor: "middle" }],
      [[p.cx - w / 2, p.cy + p.r + g, p.cx + w / 2, p.cy + p.r + g + FONT], { x: p.cx, y: p.cy + p.r + g + FONT - 2, anchor: "middle" }],
    ];
    const ok = tries.find(([b]) => !hit(b));
    if (ok) boxes.push(ok[0]);
    out.set(p.i, { ...p, label: ok ? ok[1] : null });
  }
  return pts.map((p) => out.get(p.i)!);
}

// The lines: each brand to its nearest audience, plus every pair at 0.95 or more. Thicker and darker is closer.
const STRONG = 0.95;
function edges(c: Constellation): [number, number, number][] {
  const out = new Map<string, [number, number, number]>();
  c.affinity.forEach((row, i) => {
    let best = -1;
    row.forEach((v, j) => {
      if (v === null) return;
      if (best < 0 || v > (row[best] ?? -1)) best = j;
      if (v >= STRONG) out.set(`${Math.min(i, j)}-${Math.max(i, j)}`, [Math.min(i, j), Math.max(i, j), v]);
    });
    if (best >= 0) out.set(`${Math.min(i, best)}-${Math.max(i, best)}`, [Math.min(i, best), Math.max(i, best), row[best]!]);
  });
  return [...out.values()];
}

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
  const [a, b] = picked.map((i) => c.dots[i]);
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
            <Link href={`/vs/${a.id}/${b.id}?ta=${BRAND}&tb=${BRAND}`} className={btnPrimary}>
              Open {a.name} vs {b.name}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
