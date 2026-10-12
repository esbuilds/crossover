"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Constellation, Placement } from "@/lib/constellation.ts";
import { btnPrimary, btnSecondary, field, WhichOne } from "@/app/ui";
import { edges, FONT, frame, place } from "@/lib/constellation-layout.ts";

const BRAND = encodeURIComponent("urn:entity:brand");
const ACCENT = "#bd4510"; // --color-accent, as app/vs/collide TONE (SVG takes no CSS vars)
const INK2 = "#58514d";
type Yours = { id: string; name: string; placement: Placement };
type Cand = { entity_id: string; name: string; type: string };

function Plot({ c, W, H, picked, toggle, yours, className }: { c: Constellation; W: number; H: number; picked: number[]; toggle: (i: number) => void; yours: Yours | null; className: string }) {
  const placed = place(c, W, H, 28);
  // a placed brand uses the prepared dots' frame (they never move); kept inside the box if it falls outside
  const mine = yours && (() => {
    const [x, y] = frame(c, W, H, 28)(yours.placement.x, yours.placement.y);
    const near = placed[c.dots.findIndex((d) => d.id === yours.placement.near[0].id)];
    return { cx: Math.min(W - 14, Math.max(14, x)), cy: Math.min(H - 14, Math.max(14, y)), near };
  })();
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
              <circle cx={p.cx} cy={p.cy} r={Math.max(p.r, 24)} fill="transparent" strokeWidth={2} />
              <circle cx={p.cx} cy={p.cy} r={p.r} fill={on ? ACCENT : INK2} fillOpacity={on ? 1 : 0.75} />
              {p.label ? (
                <text x={p.label.x} y={p.label.y} textAnchor={p.label.anchor} fontSize={FONT} fill={on ? ACCENT : "#2b2522"} fontWeight={on ? 600 : 400} stroke="#f8f7f6" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
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
        {mine && (
          <g aria-label={`${yours!.name}, placed`}>
            {mine.near && <line x1={mine.cx} y1={mine.cy} x2={mine.near.cx} y2={mine.near.cy} stroke={ACCENT} strokeWidth={2} strokeDasharray="4 4" />}
            <circle cx={mine.cx} cy={mine.cy} r={9} fill={ACCENT} stroke="#f8f7f6" strokeWidth={3} />
            {/* label above the dot (below near the top), anchored to stay inside the box: away from the line to its nearest */}
            <text x={mine.cx < 70 ? mine.cx - 9 : mine.cx > W - 70 ? mine.cx + 9 : mine.cx} y={mine.cy < 30 ? mine.cy + 26 : mine.cy - 14} textAnchor={mine.cx < 70 ? "start" : mine.cx > W - 70 ? "end" : "middle"} fontSize={FONT} fontWeight={600} fill={ACCENT} stroke="#f8f7f6" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
              {yours!.name}
            </text>
          </g>
        )}
      </svg>
      {folded.length > 0 && <p className="mt-2 text-sm text-ink-2">{folded.map((p, k) => `${k + 1} ${c.dots[p.i].name}`).join(" · ")}</p>}
    </div>
  );
}

export default function ConstellationView({ c }: { c: Constellation }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const [yours, setYours] = useState<Yours | null>(null);
  const [ask, setAsk] = useState<Cand[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // drop a brand onto the aisle: one cached scoring call (GET /api/aisle); the link carries ?b=<id>&n=<name>
  const apply = (ok: boolean, r: { error?: string; id?: string; inAisle?: boolean; placement?: Placement | null }, id: string, name: string) => {
    if (!ok) return setNote(r.error ?? "Qloo didn't answer.");
    history.replaceState(null, "", `?b=${id}&n=${encodeURIComponent(name)}`);
    if (r.inAisle) {
      setYours(null);
      setPicked([c.dots.findIndex((d) => d.id.toUpperCase() === r.id)]);
      return setNote(`${name} is already on this aisle.`);
    }
    if (!r.placement) {
      setYours(null);
      return setNote(`Not measured: Qloo returned too few readings for ${name} against this aisle.`);
    }
    setNote(null);
    setYours({ id, name, placement: r.placement });
  };
  const load = (id: string) => fetch(`/api/aisle?slug=${c.slug}&id=${id}`).then(async (res) => [res.ok, await res.json()] as const);
  const placeIt = async (id: string, name: string) => {
    setAsk(null);
    setBusy(true);
    try {
      const [ok, r] = await load(id);
      apply(ok, r, id, name);
    } finally {
      setBusy(false);
    }
  };
  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = q.trim();
    if (!name) return;
    setBusy(true);
    setNote(null);
    setAsk(null);
    try {
      const r = await (await fetch(`/api/resolve?q=${encodeURIComponent(name)}`)).json();
      const brands: Cand[] = (r.candidates ?? []).filter((x: Cand) => x.type === "urn:entity:brand");
      // the box takes brands only: a single brand candidate needs no question (Patagonia the brand, not the film)
      if ((r.status === "confident" && r.candidates[0]?.type === "urn:entity:brand") || brands.length === 1) return placeIt(brands[0].entity_id, brands[0].name);
      if (!brands.length) return setNote(`Qloo has no brand called ${name}.`);
      setAsk(brands);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const b = u.get("b"), n = u.get("n");
    if (b && /^[0-9a-f-]{36}$/i.test(b)) load(b).then(([ok, r]) => apply(ok, r, b, n ?? "Your brand"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].slice(-2)));
  // the link follows the category's order, not the click order: pair order is in the cache key, so either click lands warm
  const [a, b] = [...picked].sort((x, y) => x - y).map((i) => c.dots[i]);
  const aff = picked.length === 2 ? c.affinity[picked[0]][picked[1]] : null;
  return (
    <section className="mt-6">
      <Plot c={c} W={1000} H={500} picked={picked} toggle={toggle} yours={yours} className="max-sm:hidden" />
      <Plot c={c} W={360} H={540} picked={picked} toggle={toggle} yours={yours} className="sm:hidden" />
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
      <form onSubmit={find} className="mt-6 flex max-w-[640px] flex-wrap items-start gap-3 border-t border-rule pt-4">
        <label className="w-full text-base text-ink" htmlFor="yours">
          Where does your brand sit?
        </label>
        <input id="yours" value={q} onChange={(e) => setQ(e.target.value)} placeholder="A brand Qloo knows" className={`${field} min-w-0 flex-1`} />
        <button type="submit" disabled={busy} className={btnSecondary}>
          {busy ? "Placing..." : "Place it"}
        </button>
      </form>
      {ask && <WhichOne options={ask} label={(o) => o.name} onPick={(o) => placeIt(o.entity_id, o.name)} className="mt-3" />}
      <div aria-live="polite">
        {note && <p className="mt-3 text-base text-ink">{note}</p>}
        {yours && (
          <div className="mt-3 max-w-[68ch] text-base">
            <p className="text-ink">
              {yours.name} sits nearest {yours.placement.near.map((n) => `${n.name} (${n.affinity.toFixed(2)})`).join(", ")}.
            </p>
            <p className="mt-1 text-ink-2">
              Placed by its affinity to the three nearest brands; the prepared layout didn&apos;t move. Approximate.
              {yours.placement.near[0].affinity < Math.min(...c.nearest.map((n) => n.near[0]?.affinity ?? 1)) &&
                ` Its closest reading (${yours.placement.near[0].affinity.toFixed(2)}) is lower than any brand on this aisle has with its own nearest, so it sits off the aisle: read its dot as the side it leans toward, not a close neighbour.`}
              {yours.placement.fit > c.stress && ` Its three distances fit less well than the layout as a whole (${yours.placement.fit.toFixed(2)} against ${c.stress.toFixed(2)}), so read the position loosely.`}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
