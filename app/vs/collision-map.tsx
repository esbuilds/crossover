"use client";

import { useMemo } from "react";
import { ComposableMap, useMapContext } from "react-simple-maps";
import { H, INK, Labels, StatesLayer, useLabelFont, W } from "../map";
import type { City } from "@/lib/cities.ts";
import { LEAN_SPLIT, TONE, type CollideCell, type Tone } from "@/lib/collide.ts";

const OPACITY: Record<Tone, number> = { a: 0.75, b: 0.75, both: 0.6 };
const R = 2.6;

// ponytail: one <path> per tone, as the single map does per band
// reveal false holds the cells hidden in their room; flipping it to true starts the 500 ms entrance (WOW F2)
function Cells({ cells, reveal }: { cells: CollideCell[]; reveal: boolean }) {
  const { projection } = useMapContext();
  const paths = useMemo(() => {
    const d: Record<Tone, string[]> = { a: [], b: [], both: [] };
    for (const [lat, lon, tone] of cells) {
      const p = projection([lon, lat]);
      if (p) d[tone].push(`M${(p[0] - R).toFixed(1)},${p[1].toFixed(1)}a${R},${R} 0 1,0 ${R * 2},0a${R},${R} 0 1,0 ${-R * 2},0`);
    }
    return d;
  }, [cells, projection]);
  // both underneath, so the leaning cells read on top
  return (
    <g className={reveal ? "cells-in" : "invisible"}>
      {(["both", "a", "b"] as const).map((t) => paths[t].length > 0 && <path key={t} data-tone={t} d={paths[t].join("")} fill={TONE[t]} fillOpacity={OPACITY[t]} />)}
    </g>
  );
}

// The map's furniture (TR F6, CT F4): a source line, then the key, so a side never rests on hue alone.
// sourceClass lets the home page hide the source line on phones, where the first screen is tight.
export function MapKey({ a, b, sourceClass = "" }: { a: string; b: string; sourceClass?: string }) {
  const swatch = (tone: Tone, label: string) => (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block size-3 rounded-full" style={{ background: TONE[tone] }} aria-hidden />
      {label}
    </span>
  );
  return (
    <>
      <p className={`mt-1 text-xs text-ink-3 ${sourceClass}`}>Source: Qloo heatmaps, United States · cells where either audience is in its top half · Crossover&apos;s {LEAN_SPLIT} lean rule</p>
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
        {swatch("a", `Leans ${a}`)}
        {swatch("b", `Leans ${b}`)}
        {swatch("both", "Both")}
      </p>
    </>
  );
}

// reveal (default true): the home replay passes false until the split's step lands, so the states draw at first paint
// and the cells and names arrive with their step (WOW F2). /vs and /ask never pass it.
export default function CollisionMap({ cells, metrosA, metrosB, a, b, reveal = true }: { cells: CollideCell[]; metrosA: City[]; metrosB: City[]; a: string; b: string; reveal?: boolean }) {
  const { box, font } = useLabelFont();
  const inA = new Set(metrosA.map((m) => m.name)), inB = new Set(metrosB.map((m) => m.name));
  const metros = [...metrosA, ...metrosB.filter((m) => !inA.has(m.name))];
  const color = (m: City) => (inA.has(m.name) && inB.has(m.name) ? INK : inA.has(m.name) ? TONE.a : TONE.b);
  return (
    <div ref={box} className="aspect-[8/5] w-full">
      <ComposableMap projection="geoAlbersUsa" width={W} height={H} className="h-full w-full" aria-label={`US map of where ${a}'s and ${b}'s audiences over-index, cell by cell`}>
        <StatesLayer />
        <Cells cells={cells} reveal={reveal} />
        <g className={reveal ? "labels-in" : "invisible"}>
          <Labels metros={metros} hovered={null} font={font} count={metros.length} color={color} />
        </g>
      </ComposableMap>
    </div>
  );
}
