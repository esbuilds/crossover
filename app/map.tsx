"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, useMapContext } from "react-simple-maps";
import type { GeoJsonObject } from "geojson";
import states from "@/data/us-states-10m.json"; // us-atlas 3.0.1, ISC, vendored (no runtime CDN)
import type { City, MapCell } from "@/lib/cities.ts";

export const ACCENT = "#bd4510"; // --color-accent in globals.css; SVG presentation attributes take no CSS vars
export const INK = "#1b1716"; // --color-ink
const LAND = "#e9e7e6"; // --color-land

export const W = 960;
export const H = 600;
const BANDS = [0.15, 0.3, 0.5, 0.7, 0.9]; // fill opacity per affinity band; hot cells read darker
const R = 2.6;
const LABEL_PX = 14; // on-screen label size at any map width (was 7.8 px on phones)

// States never change, so render them once and never again (memo with no props).
export const StatesLayer = memo(function StatesLayer() {
  return (
    <Geographies geography={states as unknown as GeoJsonObject}>
      {({ geographies }) =>
        geographies.map((g) => (
          <Geography
            key={g.rsmKey}
            geography={g}
            fill={LAND}
            stroke="#ffffff"
            strokeWidth={0.75}
            style={{ outline: "none" }}
            tabIndex={-1} // react-simple-maps makes every state a tab stop; the map isn't interactive (CT F7)
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

// Top five (or count) plus whatever the list is hovering. Greedy placement: right, left, above, below,
// first spot that doesn't collide with an earlier label wins. color: per-metro fill (the collision map's sides).
export function Labels({ metros, hovered, font, count = 5, color }: { metros: City[]; hovered: string | null; font: number; count?: number; color?: (m: City) => string }) {
  const { projection } = useMapContext();
  const placed = useMemo(() => {
    const shown = metros.slice(0, count);
    const extra = hovered && !shown.some((m) => m.name === hovered) ? metros.find((m) => m.name === hovered) : undefined;
    const boxes: Box[] = [];
    return [...shown, ...(extra ? [extra] : [])].flatMap((m) => {
      const p = projection([m.lon, m.lat]);
      if (!p) return [];
      const [x, y] = p;
      const w = m.name.length * font * 0.5 + 4;
      const h = font + 2;
      const spots: (Box & { anchor: "start" | "end" | "middle" })[] = [
        { x: x + 11, y: y - h / 2, w, h, anchor: "start" },
        { x: x - 11 - w, y: y - h / 2, w, h, anchor: "end" },
        { x: x - w / 2, y: y - 12 - h, w, h, anchor: "middle" },
        { x: x - w / 2, y: y + 12, w, h, anchor: "middle" },
      ];
      const inside = spots.filter((s) => s.x >= 0 && s.x + s.w <= W && s.y >= 0 && s.y + s.h <= H); // never clip at the edge
      const spot = inside.find((s) => !boxes.some((b) => overlaps(s, b))) ?? inside[0] ?? spots[0];
      boxes.push(spot);
      const tx = spot.anchor === "start" ? spot.x : spot.anchor === "end" ? spot.x + spot.w : spot.x + spot.w / 2;
      return [{ m, x, y, tx, ty: spot.y + h - 4, anchor: spot.anchor }];
    });
  }, [metros, hovered, projection, font, count]);

  return (
    <g>
      {placed.map(({ m, x, y, tx, ty, anchor }) => {
        const hot = m.name === hovered;
        return (
          <g key={m.name}>
            <circle cx={x} cy={y} r={(hot ? 4.5 : 3.5) * (font / LABEL_PX)} fill={color?.(m) ?? INK} stroke="#fff" strokeWidth={font / 10} />
            <text
              x={tx}
              y={ty}
              textAnchor={anchor}
              fontSize={font}
              fontWeight={600}
              fill={color?.(m) ?? INK}
              stroke="#fff"
              strokeWidth={font / 4}
              className="font-display"
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

// labels stay LABEL_PX on screen: convert to map units from the rendered width
export function useLabelFont() {
  const box = useRef<HTMLDivElement>(null);
  const [font, setFont] = useState(21);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e.contentRect.width && setFont(Math.round((LABEL_PX * W) / e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { box, font };
}

export default function UsMap({ cells, metros, hovered }: { cells: MapCell[]; metros: City[]; hovered: string | null }) {
  const { box, font } = useLabelFont();
  return (
    // fixed aspect box: the SVG scales by viewBox, so resizing never re-lays out or jitters
    <div ref={box} className="aspect-[8/5] w-full">
      <ComposableMap projection="geoAlbersUsa" width={W} height={H} className="h-full w-full" aria-label="US heatmap of where this audience over-indexes">
        <StatesLayer />
        <Cells cells={cells} />
        <Labels metros={metros} hovered={hovered} font={font} />
      </ComposableMap>
    </div>
  );
}
