# Historical replay protocol (replay-v1)

Drafted real Oct 13, 2026. Frozen in git before stage 2 runs; the commit that adds the scored results must come after the freeze commit. Nothing below changes after the freeze.

## Question

When a brand really partnered with another brand, does Qloo's taste data put that partner near the top of a realistic list of eight, more often than chance would?

## Cases

audit/replay-cases.json: real brand-to-brand collaborations (two consumer brands, different categories, different parent companies), each with a public source. The seed is the first-named brand; the real partner is the second. Cases are chosen for being documented and well known, before any affinity is read. A real deal is not proof the pairing was good; it is only a pairing a partnerships team actually chose.

## Building the list of eight (stage 1, scripts/replay-build.ts)

No affinity is fetched in stage 1.

1. Seed and partner resolve by exact name among Qloo brands (the audit's identity rule). If either doesn't confirm, the case is dropped and listed as dropped.
2. Decoys: the real partner's most specific Qloo brand genre tag; the brands Qloo lists under that tag (no signal, up to 50), minus the seed and the partner; the seven whose Qloo popularity is closest to the partner's. If the tag holds fewer than seven others, the case is dropped.
3. Decoys are not hand-edited. If one is plainly wrong (another brand of the same company as the partner, a duplicate entity), that is recorded as a finding, not fixed.

## Scoring (stage 2, scripts/replay-score.ts, after the freeze)

1. One call per case: the seed's audience scoring the eight (filter.results.entities), with the review missing rule.
2. The partner's rank among the measured names by affinity, 1 = highest. Raw order, ties not merged.
3. **Hit**: the real partner ranks in the top three. Chance is 3 in 8.
4. A case where the partner gets no measurement is reported, and left out of the count.
5. **Pass**: the number of hits is at or above the smallest count whose one-sided binomial probability under chance (p = 3/8) is under 0.05, for the number of cases scored. The script prints that threshold before it prints any result.
6. Also reported, not part of pass/fail: the partner's mean rank against the chance mean of 4.5; whether it sits within 0.05 of the top name (the product's top group); the partner's popularity rank among the eight (the decoys are matched on popularity, so fame should not separate them).

## Reporting

Every case is published on /audit with its eight names, the partner's rank and the source, hits and misses alike, plus the dropped cases and why. If the replay fails, that is the finding, and it says so in the same place a pass would. Raw Qloo responses stay out of the repo; audit/replay.json carries names, ids and two-decimal numbers only.

## What it can't show

Whether the deals made money; whether a different partner would have done better; anything about brands Qloo doesn't know. A collaboration that happened is a decision, not an outcome.

## Excluded before the run

- Red Bull x GoPro (2016, a real partnership): GoPro's affinity under Red Bull was already seen (0.97, the audit's Red Bull brief), so it can't be a blind case.
- Liquid Death x e.l.f.: already measured (0.62, lowest group) and shown on /audit as the counterexample.

Seed order: where the source names the partner who commissioned the deal, that brand is the seed (Starbucks for Spotify and Stanley, Peloton for Lululemon); otherwise the first-named brand.

## Decoy check before the freeze (Eric, real Oct 13)

The built lists were read before any affinity. Four cases were dropped because Qloo's tag is not the real partner's category or a decoy shares the partner's parent company: Nike x Apple (tag Headphones; decoys gaming headsets and Beats, an Apple company), Taco Bell x Forever 21 (tag "Other"; decoys luxury houses), Allbirds x Adidas (tag Basketball), Dunkin' x e.l.f. (Health & Beauty decoys include fashion houses). No decoy was hand-edited. Nine cases remain; the pass threshold for nine is printed by the scoring script before any result.
