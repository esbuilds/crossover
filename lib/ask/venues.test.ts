// "Where to start": venues in one market that both the seed's and the first call's
// fans favor, by the brief's own venue params. Probe: scripts/venues-probe.ts (3 of 3 asks, real local venues, no chains).
import { test } from "node:test";
import assert from "node:assert/strict";
import { venueLine, venuesIn } from "./venues.ts";

const place = (name: string, city: string, affinity = 0.92) => ({ entity_id: name, name, city, address: `1 Main St ${city}`, affinity, tags: [], types: ["urn:entity:place"], popularity: 0.5, akas: [] });

test("venuesIn: restaurants and bars (plus live music for artists), both entities as signals, deduped, top four", async () => {
  const seen: Record<string, string | number>[] = [];
  const get = async (p: Record<string, string | number>) => {
    seen.push(p);
    return String(p["filter.tags"]).endsWith("restaurant") ? [place("Top of the Mark", "San Francisco"), place("The Rotunda", "San Francisco")] : [place("Top of the Mark", "San Francisco"), place("Tonga Room", "San Francisco"), place("Chambers", "San Francisco")];
  };
  const v = await venuesIn({ seedId: "S", pickId: "P", market: "San Francisco", artist: false }, get);
  assert.deepEqual(v.map((x) => x.name), ["Top of the Mark", "The Rotunda", "Tonga Room", "Chambers"]);
  assert.equal(seen.length, 2);
  assert.ok(seen.every((p) => p["signal.interests.entities"] === "S,P" && p["filter.location.query"] === "San Francisco"));
});

test("venueLine names the market and both brands, lists the venues, and carries no score", () => {
  const line = venueLine("San Francisco", "Allbirds", "Bombas", [{ name: "Top of the Mark" }, { name: "Tonga Room" }, { name: "The Rotunda" }]);
  assert.equal(line, "Venues in San Francisco that Allbirds and Bombas fans both favor: Top of the Mark, Tonga Room and The Rotunda.");
  assert.ok(!/\d\.\d/.test(line));
  assert.equal(venueLine("San Francisco", "Allbirds", "Bombas", [{ name: "One" }, { name: "Two" }]), null); // fewer than three: no line
});
