import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { isDemoAudit } from "./demo-audit.ts";

// the recorded asks travel with the real audit tables (private repo), and neither is in the public mirror
const real = existsSync(new URL("./ask/fixtures/allbirds.json", import.meta.url));
test("the demo-data notice shows only where the audit tables are stand-ins", () => {
  assert.equal(isDemoAudit(), !real);
});
