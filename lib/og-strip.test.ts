import { test } from "node:test";
import assert from "node:assert/strict";
import { stripBlocks, stripTitle } from "./og-strip.ts";
import replay from "../audit/replay.json" with { type: "json" };
import replayV2 from "../audit/replay-v2.json" with { type: "json" };

test("every row's one filled slot is the rank in the JSON, case by case, 14 then 9", () => {
  const [v2, v1] = stripBlocks();
  for (const [block, file] of [[v2, replayV2], [v1, replay]] as const) {
    const scored = file.cases.filter((c) => c.result?.state === "scored");
    assert.equal(block.rows.length, scored.length);
    block.rows.forEach((r, i) => {
      assert.equal(r.slots.length, 8);
      assert.equal(r.slots.filter(Boolean).length, 1);
      assert.equal(r.slots.indexOf(true) + 1, scored[i].result!.rank);
      assert.equal(r.rank, scored[i].result!.rank);
      assert.equal(r.label, `${scored[i].seed} x ${scored[i].partner}`);
    });
  }
  assert.deepEqual([v2.rows.length, v1.rows.length], [14, 9]);
});

test("the title is the /replay sentence verbatim", () => {
  assert.equal(stripTitle(), "Qloo's data put the real partner in its top three 11 times in 14. With the wrong seed brand swapped in, it still did 10 times, so these lists favor the real partner whoever is asking.");
});
