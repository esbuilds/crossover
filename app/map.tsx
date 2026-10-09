"use client";

import { memo, useMemo } from "react";
import { ComposableMap, Geographies, Geography, useMapContext } from "react-simple-maps";
import type { GeoJsonObject } from "geojson";
import states from "@/data/us-states-10m.json"; // us-atlas 3.0.1, ISC, vendored (no runtime CDN)
import type { City, MapCell } from "@/lib/cities.ts";

export const ACCENT = "#ea580c"; // shared with the affinity bars

const W = 960;
const H = 600;
const BANDS = [0.15, 0.3, 0.5, 0.7, 0.9]; // fill opacity per affinity band; hot cells read darker
const R = 2.6;
const FONT = 21; // map units; the SVG usually renders at about 2/3 scale

// States never change, so render them once and never again (memo with no props).
const StatesLayer = memo(function StatesLayer() {
  return (
    <Geographies geography={states as unknown as GeoJsonObject}>
      {({ geographies }) =>
        geographies.map((g) => (
          <Geography
            key={g.rsmKey}
            geography={g}
            fill="#e4e4e7"
            stroke="#ffffff"
            strokeWidth={0.75}
            style={{ outline: "none" }}
          />
        ))
      }
    </Geographies>
  );
});

// ponytail: 1,500 cells drawn as 5 <path> nodes (one per opacity band) instead of 1,500 circles.
// Each circle is two arcs in the band's path. Cheap to build, no per-cell DOM.
// Bands are by rank within the shown cells: the server already kept the top 1,500 by affinity,
// so raw affinity is ~1 for all of them and would paint everything the same shade.
function Cells({ cells }: { cells: MapCell[] }) {
  const { projection } = useMapContext();
  const paths = useMemo(() => {
    const d = BANDS.map(() => [] as string[]);
    const ranked = [...cells].sort((a, b) => a[2] - b[2]); // coolest first
    ranked.forEach(([lat, lon], i) => {
      const p = projection([lon, lat]);
      if (!p) return; // outside the Albers USA insets
      const band = Math.floor((i / ranked.length) * BANDS.length);
      d[band].push(`M${(p[0] - R).toFixed(1)},${p[1].toFixed(1)}a${R},${R} 0 1,0 ${R * 2},0a${R},${R} 0 1,0 ${-R * 2},0`);
    });
    return d.map((parts) => parts.join(""));
  }, [cells, projection]);
  return (
    <g>
      {paths.map((d, i) => d && <path key={i} d={d} fill={ACCENT} fillOpacity={BANDS[i]} />)}
    </g>
  );
}

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Top five plus whatever the list is hovering. Greedy placement: right, left, above, below,
// first spot that doesn't collide with an earlier label wins.
function Labels({ metros, hovered }: { metros: City[]; hovered: string | null }) {
  const { projection } = useMapContext();
  const placed = useMemo(() => {
    const shown = metros.slice(0, 5);
    const extra = hovered && !shown.some((m) => m.name === hovered) ? metros.find((m) => m.name === hovered) : undefined;
    const boxes: Box[] = [];
    return [...shown, ...(extra ? [extra] : [])].flatMap((m) => {
      const p = projection([m.lon, m.lat]);
      if (!p) return [];
      const [x, y] = p;
      const w = m.name.length * FONT * 0.56 + 4;
      const h = FONT + 2;
      const spots: (Box & { anchor: "start" | "end" | "middle" })[] = [
        { x: x + 11, y: y - h / 2, w, h, anchor: "start" },
        { x: x - 11 - w, y: y - h / 2, w, h, anchor: "end" },
        { x: x - w / 2, y: y - 12 - h, w, h, anchor: "middle" },
        { x: x - w / 2, y: y + 12, w, h, anchor: "middle" },
      ];
      const spot = spots.find((s) => !boxes.some((b) => overlaps(s, b))) ?? spots[0];
      boxes.push(spot);
      const tx = spot.anchor === "start" ? spot.x : spot.anchor === "end" ? spot.x + spot.w : spot.x + spot.w / 2;
      return [{ m, x, y, tx, ty: spot.y + h - 4, anchor: spot.anchor }];
    });
  }, [metros, hovered, projection]);

  return (
    <g>
      {placed.map(({ m, x, y, tx, ty, anchor }) => {
        const hot = m.name === hovered;
        return (
          <g key={m.name}>
            <circle cx={x} cy={y} r={hot ? 9 : 6} fill="#18181b" stroke="#fff" strokeWidth={1.5} />
            <text
              x={tx}
              y={ty}
              textAnchor={anchor}
              fontSize={FONT}
              fontWeight={hot ? 700 : 600}
              fill="#18181b"
              stroke="#fff"
              strokeWidth={5}
              paintOrder="stroke"
              style={{ pointerEvents: "none" }}
            >
              {m.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export default function UsMap({ cells, metros, hovered }: { cells: MapCell[]; metros: City[]; hovered: string | null }) {
  return (
    // fixed aspect box: the SVG scales by viewBox, so resizing never re-lays out or jitters
    <div className="aspect-[8/5] w-full">
      <ComposableMap projection="geoAlbersUsa" width={W} height={H} className="h-full w-full" aria-label="US heatmap of where this audience over-indexes">
        <StatesLayer />
        <Cells cells={cells} />
        <Labels metros={metros} hovered={hovered} />
      </ComposableMap>
    </div>
  );
}
