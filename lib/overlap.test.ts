// Geographic overlap: synthetic metros, plus the two recorded demo heatmaps when present. No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { overlapMarkets } from "./overlap.ts";
import { rankMetros, type City } from "./cities.ts";

const city = (name: string, overIndex: number): City => ({ name, lat: 0, lon: 0, score: 0, overIndex, cells: 5 });

test("only markets in both top tens, highest combined first", () => {
  const seed = [city("Austin", 140), city("Denver", 135), city("Boston", 120)];
  const partner = [city("Boston", 150), city("Austin", 130), city("Miami", 160)];
  assert.deepEqual(
    overlapMarkets(seed, partner).map((o) => [o.market, o.seed_over_index, o.partner_over_index, o.combined]),
    [
      ["Austin", 140, 130, 270],
      ["Boston", 120, 150, 270],
    ],
  );
  assert.deepEqual(overlapMarkets(seed, []), []); // a partner with no heatmap overlaps nowhere
});

test("the top-ten cut applies to both sides", () => {
  const seed = Array.from({ length: 12 }, (_, i) => city(`M${i}`, 200 - i));
  const partner = [city("M11", 300), city("M0", 100)];
  assert.deepEqual(overlapMarkets(seed, partner).map((o) => o.market), ["M0"]); // M11 is 12th for the seed
});

const dir = new URL("../fixtures/demo/", import.meta.url);
test("Liquid Death x Olipop overlap from recorded heatmaps", { skip: !existsSync(new URL("olipop.json", dir)) && "no demo fixtures" }, () => {
  const heat = (slug: string) => rankMetros(JSON.parse(readFileSync(new URL(`${slug}.json`, dir), "utf8")).heatmap);
  const o = overlapMarkets(heat("liquid-death"), heat("olipop"));
  assert.ok(o.length >= 3, `${o.length} shared markets`);
  assert.ok(o.every((m, i) => i === 0 || o[i - 1].combined >= m.combined));
  assert.ok(o.some((m) => m.market === "San Diego")); // top five for both on Oct 12
});
