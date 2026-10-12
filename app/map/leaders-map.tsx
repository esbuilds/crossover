"use client";

import { useMemo } from "react";
import { ComposableMap, useMapContext } from "react-simple-maps";
import { H, StatesLayer, W } from "../map";
import type { LeaderCell } from "@/lib/leaders.ts";
import { LEADER_TONE } from "@/lib/leader-tones.ts";

const R = 2.6;

// ponytail: one <path> per leader, as the pair map does per tone
function Cells({ cells }: { cells: LeaderCell[] }) {
  const { projection } = useMapContext();
  const paths = useMemo(() => {
    const d: string[][] = [[], [], []];
    for (const [lat, lon, k] of cells) {
      const p = projection([lon, lat]);
      if (p) d[k].push(`M${(p[0] - R).toFixed(1)},${p[1].toFixed(1)}a${R},${R} 0 1,0 ${R * 2},0a${R},${R} 0 1,0 ${-R * 2},0`);
    }
    return d;
  }, [cells, projection]);
  return <g>{paths.map((p, k) => p.length > 0 && <path key={k} d={p.join("")} fill={LEADER_TONE[k]} fillOpacity={0.8} />)}</g>;
}

export default function LeadersMap({ cells, names }: { cells: LeaderCell[]; names: string[] }) {
  return (
    <div className="aspect-[8/5] w-full">
      <ComposableMap projection="geoAlbersUsa" width={W} height={H} className="h-full w-full" aria-label={`US map of which of ${names.join(", ")} over-indexes most in each cell`}>
        <StatesLayer />
        <Cells cells={cells} />
      </ComposableMap>
    </div>
  );
}
