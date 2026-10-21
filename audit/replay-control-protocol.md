# Replay control: scrambled seeds (replay-control, PROOF-1)

Drafted real Oct 22, 2026 (UTC Oct 21). Committed in git, with the draw, before any Qloo call for this test. Nothing below changes after this commit; the result is published either way.

## Question

The replays (audit/replay-protocol.md, audit/replay-v2-protocol.md) put the real partner in the top three of eight 17 times in the 23 scored cases (v1 6 of 9, v2 11 of 14; pooled after the fact). Is that the seed's fans, or would the real partner rank high under anyone's fans because of how the eight were built? Score each case's frozen eight again under a different case's seed.

## The draw (0 calls, committed with this file)

- Cases: the 23 scored cases in file order, v1's nine then v2's fourteen. Their eights, ids and frozen ranks are not changed.
- `scripts/replay-control-tags.ts` reads each seed's own Qloo tags from the search the replay build already cached (peek only, 0 calls; the first twelve tags, which is what the cache keeps) into `audit/replay-control-seed-tags.json`.
- `scripts/replay-control-draw.py` shuffles the 23 seeds with Python's `random.Random(20261022)` and redraws until every case passes:
  1. no case keeps its own seed (by Qloo id; Doritos is the seed of two cases and can't land on either);
  2. the scrambled seed is not one of the eight it scores;
  3. the scrambled seed doesn't share the partner's tag: its own real deal's partner isn't under this case's tag, and the tag isn't among its own tags (cached tags, plus the tag of any case where that brand is itself the partner).
- It took 119 draws. The map is `audit/replay-control-draw.json`.

## Scoring (scripts/replay-control.ts, after this commit)

One call per case, identical to scripts/replay-score.ts except the seed: `GET /v2/insights`, `filter.type=urn:entity:brand`, `signal.interests.entities=<scrambled seed id>`, `filter.results.entities=<the frozen eight>`, `take=8`; the same missing rule (lib/review.ts `applyMissingRule`, "one call"); the real partner's rank among the measured names. 23 calls. No model anywhere.

A case where the real partner gets no measurement under the scrambled seed is counted as a scrambled hit, against the test, and reported by name.

## Bar

Chance is 3 in 8, a mean of 8.6 of 23.

- PASS if scrambled hits are 12 or fewer of 23 (13 or more by chance has p = 0.0496, the v2 rule applied to 23), and the real hits (17) exceed the scrambled hits by at least 4.
- FAIL otherwise: the eights favor the real partner whoever is asking, and the replay is partly an artifact of the lists. The 11 of 14 line then carries this result beside it.
- Reported, not gated: each case's scrambled rank beside its real rank, and the mean scrambled rank against 4.5.

## Reporting

Published on /audit under the v2 block ("Replay controls") the day it runs, pass or fail, with this file's commit.

## The stored popularityRank field (note, real Oct 22)

`audit/replay.json` and `audit/replay-v2.json` store a `result.popularityRank` for each case. scripts/replay-score.ts computed it with a stable sort that lists the real partner first, so among equal popularities the partner always wins the tie. It reads 21 of 23 in the top three; it favors the partner and is not a result. Fairly broken ties give about 10.6 of 23 (`audit/popularity-fair.json`, scripts/popularity-fair.ts, a re-analysis of stored numbers, not a test). The replay files are frozen and stay as they are.
