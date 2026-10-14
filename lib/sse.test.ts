// Found in the Oct 13 adversarial pass: a visitor who leaves mid-run closes the stream, and the next send threw an
// unhandled "Controller is already closed" that could take the function down. Sends after a close are dropped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sse } from "./sse.ts";

test("sends after the reader leaves are dropped, not thrown", async () => {
  let thrown: unknown = null;
  const onRejection = (e: unknown) => (thrown = e);
  process.on("unhandledRejection", onRejection);
  let finished = false;
  const res = sse(async (send) => {
    send({ n: 1 });
    await new Promise((r) => setTimeout(r, 30));
    send({ n: 2 }); // the reader is gone by now
    finished = true;
  });
  const reader = res.body!.getReader();
  await reader.read();
  await reader.cancel();
  await new Promise((r) => setTimeout(r, 80));
  process.off("unhandledRejection", onRejection);
  assert.equal(thrown, null);
  assert.equal(finished, true); // the work runs to its end (the cache still gets the result)
});
