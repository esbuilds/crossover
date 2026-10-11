// The collision map as a standalone SVG string, for the /vs share card (next/og can't run react-simple-maps).
// Same projection family, cells and tones as app/vs/collision-map.tsx; states from the vendored us-atlas file.
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import states from "../data/us-states-10m.json" with { type: "json" };
import { TONE, type Collision } from "./collide.ts";

const LAND = "#e9e7e6"; // --color-land
const R = 2.6;
const land = feature(states, (states as { objects: { states: unknown } }).objects.states);

export function mapSvg(map: Pick<Collision, "cells">, w = 960, h = 600): string {
  const projection = geoAlbersUsa().fitExtent([[8, 8], [w - 8, h - 8]], land);
  const path = geoPath(projection);
  const shapes = land.features.map((f) => path(f) ?? "").join("");
  const tones: Record<string, string[]> = { both: [], a: [], b: [] };
  for (const [lat, lon, tone] of map.cells) {
    const p = projection([lon, lat]);
    if (p) tones[tone].push(`M${(p[0] - R).toFixed(1)},${p[1].toFixed(1)}a${R},${R} 0 1,0 ${R * 2},0a${R},${R} 0 1,0 ${-R * 2},0`);
  }
  const cells = (["both", "a", "b"] as const).map((t) => (tones[t].length ? `<path d="${tones[t].join("")}" fill="${TONE[t]}" fill-opacity="${t === "both" ? 0.6 : 0.8}"/>` : "")).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${shapes}" fill="${LAND}" stroke="#ffffff" stroke-width="0.75"/>${cells}</svg>`;
}
