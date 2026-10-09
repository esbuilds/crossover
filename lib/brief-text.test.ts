import test from "node:test";
import assert from "node:assert/strict";
import { figureLead, labelled, reverseFigure, sections, venueLine } from "./brief-text.ts";

test("brief text splits into sections, labels, figures and venues", () => {
  const s = sections("## The idea\nA drop.\n\n## Fit scorecard\n- Audience affinity: #3 of 10\n- Mutual fit: Liquid Death ranks #39 in the top 50\n## Launch plan\n- Venue: Whisky a Go Go, West Hollywood. A rock room.");
  assert.deepEqual(
    s.map((x) => x.heading),
    ["The idea", "Fit scorecard", "Launch plan"],
  );
  assert.deepEqual(s[0].paras, ["A drop."]);
  assert.deepEqual(labelled(s[1].bullets[0]), { label: "Audience affinity", body: "#3 of 10" });
  assert.equal(reverseFigure(labelled(s[1].bullets[1]).body), "#39 of 50 for their fans");
  assert.equal(reverseFigure("Liquid Death is not in Dr. Squatch fans' top 50."), "Outside their top 50");
  const v = labelled(s[2].bullets[0]);
  assert.equal(v.label, "Venue");
  assert.deepEqual(venueLine(v.body), { name: "Whisky a Go Go", area: "West Hollywood", rest: "A rock room." });
  assert.deepEqual(venueLine("Academy LA, 6021 Hollywood Blvd (affinity 0.914). A nightlife spot."), { name: "Academy LA", area: "6021 Hollywood Blvd", rest: "A nightlife spot." });
  assert.deepEqual(figureLead("Affinity 0.87 at slate rank #3: fans seek it out."), { lead: "Affinity 0.87 at slate rank #3", rest: "fans seek it out." });
  assert.deepEqual(figureLead("Both brands carry the Minimalist tag. More words."), { lead: null, rest: "Both brands carry the Minimalist tag. More words." });
  assert.equal(figureLead("Forward affinity of 0.87 puts Dr. Squatch at #1. More.").lead, "Forward affinity of 0.87 puts Dr. Squatch at #1");
  // partial text while streaming: no crash, a bullet before any heading still lands somewhere
  assert.equal(sections("- early").length, 1);
});
