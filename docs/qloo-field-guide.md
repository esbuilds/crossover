# Qloo field guide

What the hackathon host (`https://hackathon.api.qloo.com`) returned when Crossover asked, and what the product does
because of it. Each entry names what we asked, what came back, what we shipped, and the file that holds the run. Dates
are when the probe ran (Oct 2026). Nothing here needed a new call to write. Files under `probe/` are the working notes
from those runs, kept outside this repo because they hold full score matrices; every other file named here is in the repo.

## Search and identity

**Small brands by name.**
- Asked: `/search` for ten small food, drink and beauty brands by name (Oct 8).
- Came back: none returned itself; each returned another brand (Fruition Chocolate Works came back as Bath & Body Works).
- Shipped: every name is confirmed before a call (`lib/resolve.ts`), and an unknown name stops the ask at step 1.
- File: `probe/out` (the Oct 8 probe run), summarised on /audit#api-notes.

**An exact name carried by two types.**
- Asked: `/search` for 24 typed names across brand, artist, TV show, movie and person (Oct 10).
- Came back: Corona, Mars, Ghost and Prime confirmed to an entity of another type that Qloo listed first.
- Shipped: an exact name that another type also carries asks which one.
- File: `audit/results.json`.

**A team at popularity 0.**
- Asked: `/search` for "New York Yankees" (Oct 11).
- Came back: the team and a movie, both at popularity 0.00. Lists and the heatmap work on the team's id (7,773 cells).
- Shipped: a typed Yankees goes to the resolver's picker; the prepared pair uses the hand-picked id.
- File: `probe/VERIFY-4.md` (finding 7).

## Scoring a fixed list

**Batching with `filter.results.entities`.**
- Asked: one `/v2/insights` call with seven brand ids in `filter.results.entities`, against seven single calls, then the same ids in reverse order (Oct 10).
- Came back: the same scores to four decimals in every form (Yeti 0.7667, Chanel 0.5906). An artist id inside a `filter.type=brand` call was dropped without an error. No `filter.type` returned 400 ("filter.type is required"); a comma list of types returned 400 ("not supported").
- Shipped: one scoring call per entity type, and types are never ranked against each other (`lib/review.ts`, `scoreForward`).
- File: `probe/VERIFY-3.md` (section 1).

**The `take` ceiling.**
- Asked: scoring a 100-name union in one call (Oct 11).
- Came back: 400, "take must be an integer value between 1 and 50". At 50, every candidate came back.
- Shipped: the rivals union is scored in chunks of 50 (`lib/rivals.ts`).
- File: `probe/VERIFY-4.md` (finding 6).

**Repeated values across unrelated pairs.**
- Asked: the same candidates under several seeds and audience profiles (Oct 10).
- Came back: some pairs carried the same affinity under every signal (with Liquid Death as seed: e.l.f. 0.671, Van Leeuwen 0.668, Poppi 0.721 in all four rows), and 0.765 and 0.554 recurred across unrelated candidates and seeds.
- Shipped: three missing-data rules: a floor value, three or more bit-identical values in one call, and a value repeating across different signals all read "no measurement", never a score (`lib/review.ts`, `Missing`).
- File: `probe/VERIFY-3.md` (section 2). In 10 two-seed scoring calls on Oct 11 the rule didn't fire (`probe/VERIFY-4.md`, finding 3).

**Same-type affinity in both directions.**
- Asked: Olipop scored against six brands, then each brand scored against Olipop.
- Came back: the reverse values equalled the forward ones.
- Shipped: the other direction is read as a rank among each brand's own fans' top 50, never as a second score (`lib/ask/both-ways.ts`). That rank is the both-ways line on an answer card, shown only where it separates the agent's three (lib/ask/both-rules.ts).
- File: `probe/VERIFY-3.md`, `scripts/reverse-probe.ts`.

**A popularity cap on the same list.**
- Asked: each seed's fans' top 20 brands, as is and with `filter.popularity.max=0.5` (Oct 18).
- Came back: an entity in both reads carried the same affinity in both. Some brands carry popularity 0.
- Shipped: "Smaller names, nearly the same fit" compares the two reads directly, and popularity 0 is left out as "no measurement" (`lib/ask/smaller.ts`).
- File: `audit/popularity-probe.json`.

## Tags and categories

**Brands with no genre tag.**
- Asked: the tags of nine test brands (Oct 11).
- Came back: Olipop, Erewhon and A24 carried no brand genre tag among 98 to 114 tags each.
- Shipped: the rival finder falls back to Qloo's product category (`lib/rival.ts`).
- File: `probe/VERIFY-4.md`, `lib/rival.ts`.

**Category words as tags.**
- Asked: `/v2/tags` for five category words (Oct 12).
- Came back: "Streaming services" matched Financial Services and returned banks; "fast-casual burgers" matched no tag.
- Shipped: the three category maps stay prepared; no typed category.
- File: `scripts/aisle-probe.ts`.

**Genre tags across leagues.**
- Asked: a cold ask for Los Angeles Dodgers (before judging, gate written first).
- Came back: the same-field cut reads genre tags, and the Dodgers' candidates included NFL teams.
- Shipped: the candidates step names the field it cut, or says it had nothing to cut with (`lib/ask/field-notes.ts`).
- File: `audit/judge-names.json`.

**Names in a forward replay.**
- Asked: confirming 13 recent deals' names, chosen by rule before any call.
- Came back: five of the ten eligible names didn't confirm in Qloo and two had no genre tag, mostly small food and drink brands.
- Shipped: the forward replay stopped before scoring, and the rule, list and counts are on /audit.
- File: `audit/replay-v3-search-log.md`, `audit/replay-v3.json`.

## Places, heatmaps and the other endpoints

**Top five metros.**
- Asked: the top five metros for each of Allbirds' eight candidates (Oct 15).
- Came back: each top five sat inside a tie within a point of its fifth.
- Shipped: no card names a call and a place together.
- File: `scripts/markets-probe.ts`.

**A person's heatmap.**
- Asked: the national heatmap for Cedric the Entertainer (person) (Oct 11).
- Came back: the top five metros all at 113, across 6,327 cells.
- Shipped: a pair with a person seed gets no map (`lib/rivals.ts`).
- File: `probe/VERIFY-4.md` (Cedric the Entertainer).

**`/v2/insights/compare`.**
- Asked: Liquid Death against Celsius, with and without `filter.type=urn:entity:brand` (Oct 11).
- Came back: 200 in about 200 to 525 ms; shared tags with a score (Food & Beverage 0.731, Drinks 0.730), each side's tags, and an empty `matchEntities`. The response was identical with and without the filter.
- Shipped: the "Share by category" line on /vs and nothing else (`lib/qloo.ts`, `compareTags`).
- File: `probe/VERIFY-4.md` (/v2/insights/compare).

**`bias.trends`.**
- Asked: each demo seed's list with `bias.trends=off` and `very_high`.
- Came back: off matched the default list for all four demo seeds; very high put the same three entities in front of every seed's list.
- Shipped: the trends feature is off by default (`CROSSOVER_TRENDS=on` to enable).
- File: `lib/trends.ts` (the note above `classifyTrends`).

**Audience profiles.**
- Asked: `/v2/audiences` without a filter, then with one; and each seed's list with an age or audience profile added to the seed (Oct 9 and 10).
- Came back: 400 without one of its listed filters, and ten audience types with one. With the seed in the signal, profile rows kept the seed-alone order (Spearman rho 0.62 to 0.98); age brackets moved candidates about 0.05.
- Shipped: no portfolio planner. One age sentence per pairing uses `signal.demographics.age` (`lib/cohort.ts`).
- File: `probe/VERIFY-2.md` (section c), `probe/VERIFY-3.md` (sections 2 and 5).

## Quota

**The month's remaining calls.**
- Asked: every call, through `lib/qloo.ts`.
- Came back: an `X-Month-RateLimit-Remaining` header on each response, and `X-Second-RateLimit-Reset` on a 429.
- Shipped: `/api/usage` reports the header's last value beside the day's count, and a 429 waits for the reset and retries once (`lib/qloo.ts`).
- File: `lib/qloo.ts`.
