// topojson-client ships no types; the one function the OG map card uses.
declare module "topojson-client" {
  import type { FeatureCollection } from "geojson";
  export function feature(topology: unknown, object: unknown): FeatureCollection;
}
