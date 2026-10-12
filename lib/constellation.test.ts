import { test } from "node:test";
import assert from "node:assert/strict";
import { build, mds, stress, type Category } from "./constellation.ts";
import { FLOORS } from "./review.ts";
import type { Entity } from "./qloo.ts";

const e = (id: string, affinity: number, popularity = 0.9): Entity => ({ entity_id: id, name: id, types: ["urn:entity:brand"], popularity, akas: [], tags: [], affinity });

test("mds recovers a square's distances", () => {
  const s = Math.SQRT2;
  const D = [
    [0, 1, s, 1],
    [1, 0, 1, s],
    [s, 1, 0, 1],
    [1, s, 1, 0],
  ];
  const xy = mds(D);
  assert.ok(stress(D, xy) < 1e-6);
  assert.ok(Math.abs(Math.hypot(xy[0][0] - xy[2][0], xy[0][1] - xy[2][1]) - s) < 1e-6);
});

const cat: Category = { slug: "t", title: "T", brands: ["A", "B", "C", "D", "E"].map((n) => ({ name: n, id: n })) };

test("two clear groups land apart, nearest lists follow affinity", () => {
  // A,B,C close; D,E close; the last brand (E) is never a seed
  const high = 0.95, low = 0.6;
  const near = (x: string, y: string) => (["ABC", "DE"].some((g) => g.includes(x) && g.includes(y)) ? high : low);
  const rows = cat.brands.slice(0, -1).map((s) => cat.brands.filter((b) => b.id !== s.id).map((b, k) => e(b.id, near(s.id, b.id) - k * 0.001)));
  const c = build(cat, [...rows, null]);
  assert.equal(c.dots.length, 5);
  const p = Object.fromEntries(c.dots.map((d) => [d.name, d]));
  const dist = (x: string, y: string) => Math.hypot(p[x].x - p[y].x, p[x].y - p[y].y);
  assert.ok(dist("A", "B") < dist("A", "D"));
  assert.ok(dist("D", "E") < dist("C", "E"));
  assert.equal(c.nearest.find((n) => n.name === "D")!.near[0].name, "E");
  assert.ok(p.A.popularity !== null, "the first seed gets its popularity from the second seed's call");
});

test("a brand with mostly missing readings is listed, never placed", () => {
  // every call returns E at a Qloo fallback constant, so E has no readings
  const rows = cat.brands.slice(0, -1).map((s, si) => cat.brands.filter((b) => b.id !== s.id).map((b, k) => e(b.id, b.id === "E" ? [...FLOORS][0] : 0.7 + 0.01 * k + 0.003 * si)));
  const c = build(cat, [...rows, null]);
  assert.deepEqual(c.notMeasured, ["E"]);
  assert.equal(c.dots.length, 4);
});

test("a brand Qloo never returns (an id it doesn't know) is listed, never placed", () => {
  // as a seed it returns nothing, and no other call returns it
  const rows = cat.brands.slice(0, -1).map((s, si) => (s.id === "C" ? [] : cat.brands.filter((b) => b.id !== s.id && b.id !== "C").map((b, k) => e(b.id, 0.7 + 0.01 * k + 0.003 * si))));
  const c = build(cat, [...rows, null]);
  assert.deepEqual(c.notMeasured, ["C"]);
  assert.ok(!c.dots.some((d) => d.name === "C"));
  assert.ok(c.nearest.every((n) => n.near.every((x) => x.name !== "C")));
});
