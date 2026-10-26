# Reverse replay, with its control (replay-reverse, PROOF-2)

Drafted real Oct 22, 2026 (UTC Oct 21). Committed in git before any Qloo call for this test. Nothing below changes after this commit; the result is published either way.

## Why

The replays scored one direction: the seed's fans scoring the eight. The scrambled-seed control (audit/replay-control-protocol.md, 902906a) failed: under a wrong seed the real partner still landed in the top three 17 times in 23, as under its own. That direction doesn't separate the seed. This test scores the other direction, the one the front door now quotes ("Bombas fans rank Allbirds first"): where each candidate's own fans rank the seed.

## Cases

All 23 scored cases, in file order (v1's nine, then v2's fourteen), with their frozen eights. Nothing about the eights changes.

## Rule (scripts/replay-reverse.ts, lib/replay-reverse.ts)

- For each of the eight: `GET /v2/insights`, `filter.type=urn:entity:brand`, `signal.interests.entities=<candidate id>`, `take=50` (the call lib/ask/both-ways.ts uses). The seed's position in that list, 1 to 50, or "not in their top 50".
- The eight are ranked by that position, lowest first. Every "not in their top 50" ties below every position. **Ties break against the real partner**: it takes the last place in its tie. So a partner whose fans don't have the seed in their top 50 is always 8th, a miss.
- Hit: the real partner in the top three of eight.
- No measurement: a case where any of the eight lists comes back empty. It counts as a miss for the real seed and a hit for the scrambled seed, against the test.

## Control, in the same run

The scrambled seeds of audit/replay-control-draw.json, unchanged. The reverse call doesn't depend on the seed, so the scrambled seed's position is read from the same eight responses: the control costs no extra call. Same rule, same tie-break, same hit.

## Bar

Chance is 3 in 8 with no ties; ties broken against the partner only lower it, so 3 in 8 is the conservative chance figure. PASS needs both:

1. Real hits 13 or more of 23 (13 or more by chance has p = 0.0496), and
2. real hits exceed the scrambled hits by at least 4.

FAIL otherwise. Reported, not gated: mean partner rank for each, the v2 subset, and how many of the 184 lists don't have the seed in their top 50 (famous seeds sit in many lists, small ones in few).

## Budget

One call per distinct candidate: 106 at most across the 23 cases (cases share eights), cached after. Cap 400. `/api/usage` logged before and after.

## Reporting

A "Reverse replay" paragraph under Replay controls on /audit, the day it runs, pass or fail, with this file's commit.
