# Replay v3: fresh deals chosen by rule (out of sample)

Written real Oct 16, 2026, on Fable's ruling (research/brief-oct16-moonshots-ruling.md, section 1). This file is committed before any search for cases, and nothing in it changes after that commit. v1 (6 of 9, missed its bar) and v2 (11 of 14) stay on /audit unchanged. v3 is a third, separate test: never pooled with them, and its cases never enter /replay.

## What "out of sample" means here

The replay protocol was last changed at 3dc6576 (Oct 13, 2026, 17:19 PDT, "Replay v2 frozen"): candidate rule, decoy rule, hit rule and bar. Nothing in scripts/replay-build.ts or scripts/replay-score.ts has changed since. The changes to lib/qloo.ts since then are a dev-only outage drill and a new audiences endpoint, so the replay path doesn't touch them. v3 cases are chosen by the rule below, after that freeze, and the full list is committed before any Qloo call. Nobody picked them knowing a score.

Qloo's data may already reflect an announced deal. That applies to all 23 earlier cases as much as to these.

## The rule

1. **Sources, two only:** Marketing Dive (marketingdive.com) and Food Dive (fooddive.com).
2. **Window:** articles published Aug 17, 2026 to Oct 16, 2026 inclusive (the 60 days ending the day this file was written).
3. **Inclusion:** the article reports a co-branded product, collection, menu item or campaign between exactly two named brands. The seed is the brand whose product or campaign it is, or the first brand named in the headline when that's unclear. The partner is the other brand. Both have to be brands. A celebrity, artist, athlete, team, league, film, show, game title or creator counts as "not a brand".
4. **Search procedure:** each source's site search, plus a web search restricted to each domain, for "collaboration", "collab", "partnership", "co-branded" and "limited edition". Every article the search turns up that meets rule 3 goes on the list in the order found, before any Qloo call.
5. **Cap:** at most 10 cases get scored. If more than 10 survive the exclusions, the 10 most recently published are taken (ties broken by source, alphabetically).

## Exclusions allowed (each one published with its reason, and counted)

- **a. Already used.** Either brand is a seed or partner in one of the 23 scored cases (Crocs, KFC, Heinz, Absolut, Levi's, Google, Peloton, Lululemon, Starbucks, Spotify, Supreme, Oreo, Taco Bell, Doritos, Uber, Wendy's, Pringles, Ben & Jerry's, Nike, Coca-Cola, Converse, Netflix, Twitch, Dunkin', Urban Outfitters, Goldfish, Jack in the Box, The Hundreds, Krispy Kreme, McDonald's, Pacsun, Sour Patch Kids, Under Armour, Reebok, The North Face, Jeep), or is one of the six judge-probe names (Los Angeles Dodgers, Noah Kahan, Cedric the Entertainer, PlayStation, Calm, Chipotle).
- **b. Not a brand pair** under rule 3, or more than two brands.
- **c. No public source.** The article isn't reachable at a stable URL.
- **d. Qloo search misses a brand.** The seed or partner doesn't confirm under the v1 identity rule (scripts/replay-build.ts). The row prints "m found, k excluded because Qloo search missed a brand", because this exclusion biases v3 toward brands Qloo knows.
- **e. The v2 decoy check, unchanged** (audit/replay-v2-protocol.md): the case is dropped, not fixed, when the partner's tag is "Other", when the tag names a product the partner isn't known for, or when a decoy is the partner's parent or a brand under the same parent. The partner having no brand genre tag, or a tag holding fewer than seven other brands, drops it too (v1 rule). No decoy is hand-edited. Eric reads the built lists before the run, as in v2.

## Run and bar

- Build with scripts/replay-build.ts (no affinity read), then score with scripts/replay-score.ts. Both run unchanged. One scoring run. No re-run, no tweak, no second window.
- A hit means the real partner is in the top three of eight. Chance is three in eight.
- The bar is v2's rule applied to n: the smallest hit count whose one-sided binomial probability at 3 in 8 is under 0.05. For each n:

| n | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|
| hits needed | 5 | 5 | 6 | 6 | 7 | 7 |

- **Floor:** fewer than 5 scored cases means no v3 line. It becomes a probe entry on /audit saying how many were found and why they fell out, and the Devpost carries no sentence about it.
- **Reporting:** every case, hit or miss, with its eight names and source, plus every exclusion and its reason. The row reads "n of m, chosen by rule, list committed at <hash> on <date>, run once". The words "confirms" and "validates" don't appear.

## Budget

At most 20 Qloo calls for the resolution check (exclusion d) and at most 100 for build and score. That's well under the 600 daily cap.
