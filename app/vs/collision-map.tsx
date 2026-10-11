"use client";

import { useMemo } from "react";
import { ComposableMap, useMapContext } from "react-simple-maps";
import { H, INK, Labels, StatesLayer, useLabelFont, W } from "../map";
import type { City } from "@/lib/cities.ts";
import { TONE, type CollideCell, type Tone } from "@/lib/collide.ts";

const OPACITY: Record<Tone, number> = { a: 0.75, b: 0.75, both: 0.6 };
const R = 2.6;

// ponytail: one <path> per tone, as the single map does per band
function Cells({ cells }: { cells: CollideCell[] }) {
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
    <g>
      {(["both", "a", "b"] as const).map((t) => paths[t].length > 0 && <path key={t} d={paths[t].join("")} fill={TONE[t]} fillOpacity={OPACITY[t]} />)}
    </g>
  );
}

export default function CollisionMap({ cells, metrosA, metrosB, a, b }: { cells: CollideCell[]; metrosA: City[]; metrosB: City[]; a: string; b: string }) {
  const { box, font } = useLabelFont();
  const inA = new Set(metrosA.map((m) => m.name)), inB = new Set(metrosB.map((m) => m.name));
  const metros = [...metrosA, ...metrosB.filter((m) => !inA.has(m.name))];
  const color = (m: City) => (inA.has(m.name) && inB.has(m.name) ? INK : inA.has(m.name) ? TONE.a : TONE.b);
  return (
    <div ref={box} className="aspect-[8/5] w-full">
      <ComposableMap projection="geoAlbersUsa" width={W} height={H} className="h-full w-full" aria-label={`US map of where ${a}'s and ${b}'s audiences over-index, cell by cell`}>
        <StatesLayer />
        <Cells cells={cells} />
        <Labels metros={metros} hovered={null} font={font} count={metros.length} color={color} />
      </ComposableMap>
    </div>
  );
}
