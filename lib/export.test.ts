// Markdown export shape. No API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { briefMarkdown, exportFilename } from "./export.ts";

const brief = "## The idea\nA drop.\n\n## Fit scorecard\n- Audience affinity: #1 of 10\n\n## The evidence\n- 0.87\n\n## Launch plan\n- Market: Austin\n\n## The ask\nA call.";

test("brief, in order, with title and source line; outreach only when approved", () => {
  const md = briefMarkdown({ seed: "Liquid Death", partner: "Dr. Squatch", brief, date: "2026-10-15" });
  const heads = md.split("\n").filter((l) => l.startsWith("#"));
  assert.deepEqual(heads, ["# Liquid Death x Dr. Squatch: partnership brief", "## The idea", "## Fit scorecard", "## The evidence", "## Launch plan", "## The ask"]);
  assert.ok(md.includes("on 2026-10-15."));
  assert.ok(!md.includes("Outreach"));

  const approved = briefMarkdown({ seed: "Liquid Death", partner: "Dr. Squatch", brief, outreach: "Subject: Hi\n\nHello.", date: "2026-10-15" });
  assert.ok(approved.trimEnd().endsWith("## Outreach draft\n\nSubject: Hi\n\nHello."));
});

test("proxy briefs say what they're based on", () => {
  const md = briefMarkdown({ seed: "Graza", partner: "Great Jones", basedOn: ["Brightland", "Sir Kensington's"], brief, date: "2026-10-15" });
  assert.ok(md.includes("Graza isn't in Qloo yet; this is based on fans of Brightland, Sir Kensington's."));
});

test("file names are safe", () => {
  assert.equal(exportFilename("Liquid Death", "Dr. Squatch Soap Co."), "liquid-death-x-dr.-squatch-soap-co.-brief.md");
});
