import test from "node:test";
import assert from "node:assert/strict";
import { classifyTrends } from "./trends.ts";

test("trends: chips only when trends off reshapes the list; durable holds, trending drops out", () => {
  const kept = ["a", "b", "c"];
  const base = ["a", "b", "c", "d"];
  // trends off changes nothing (what the hackathon API returned for all four demo seeds): no chips at all
  assert.deepEqual(classifyTrends(kept, base, ["a", "b", "c", "d"], ["v", "w", "a", "b"]), {});
  // trends off drops b: a and c hold (durable), b only shows with trends high (trending)
  assert.deepEqual(classifyTrends(kept, base, ["a", "c", "d", "x"], ["b", "a", "z", "c"]), { a: "durable", b: "trending", c: "durable" });
  // a kept brand in neither list gets nothing
  assert.deepEqual(classifyTrends(["q"], base, ["a"], ["b"]), {});
});
