# Crossover

Eight brands could partner with you. Which three do you call first? Crossover asks you to pick, then lays the same eight out twice: by how well known they are (Qloo popularity) and by how much your fans lean toward them (Qloo affinity). For Mt. Joy, fame can't tell the eight apart and taste can. Behind that front door is a review desk with honest ties, buyer gates and per-name evidence, a public audit run on briefs frozen before the run, and the partner search: a slate across six Qloo domains, launch markets, a one-page brief, approval before any outreach. Built for the Qloo Agentic Hackathon (2026).

## The 30-second path

1. Open https://crossover-henna.vercel.app. Pick three of Mt. Joy's eight brands and click **Show me**.
2. Read the two columns: popularity bands on the left, measured taste groups on the right (a group is every name within 0.05 of its strongest member). Click any name for its evidence.
3. Turn on **Exclude energy drinks**: Red Bull drops out, with Qloo's tag as the reason.
4. Open **/audit** for the held-out results, then **Find more partners for Mt. Joy** for the slate, map and briefs.

## The review desk

`lib/review.ts` holds the rules (label `review-v3`), `app/api/review/route.ts` serves them, and the page only renders.

- **Identity first.** Only an exact name confirms on its own; an exact name that a known entity of another type also carries asks which one. LLM suggestions never confirm. Ambiguous names get a one-click picker, and share links carry the chosen id.
- **One call scores the list.** `filter.results.entities` with every candidate's id scores a fixed list against the seed's audience, one call per entity type. Types are never ranked against each other.
- **Leader-relative ties.** A group is the strongest measured name plus everything within 0.05 of it; no order is claimed inside a group. A top group of four or more is "no clear three".
- **Missing is never zero.** Qloo's fallback constants, three or more bit-identical values in one call, and a pair repeating across unrelated signals all read "no measurement".
- **Buyer gates.** Named exclusions and whole-word tag exclusions are hard gates; the reason quotes Qloo's tag.
- **Rank facts, not direction words.** Same-type affinity in Qloo is symmetric, so the product reports where each side ranks among the other's fans, never that one side likes the other more.

## The audit

`audit/briefs.json` is the protocol (audit-v1): twelve brand briefs of eight candidates, split six dev and six held-out by a fixed seed, plus 24 resolution challenges. It was frozen in git (commit `d244ee2`) before the held-out briefs ran once through `scripts/audit-run.ts`. `audit/results.json` keeps derived numbers only, and `/audit` shows them: 4 of 6 held-out briefs give a clear three; 0 of 12 "famous" names reach the picks; resolution was 20 of 24 as run and 24 of 24 after the review-v3 fix, labelled as not held-out.

## Rivals (/vs and the front door)

Two names, one question: where do their audiences part ways? The front door's two inputs run a pair; leave the right one blank and the finder picks a rival. Pairs are cached by order, so A vs B and B vs A are separate keys; links the app builds (the category maps' "Open X vs Y") always use one fixed order so any click lands on the same cached pair.

```mermaid
flowchart LR
  F["rival finder<br/>lib/rival.ts"] -- "pick (0 if the seed is warm, else 2 + fullTags 2)" --> R
  R["rivals<br/>lib/rivals.ts"] -- "2 top-50 lists + 2 to 4 scoring" --> Q[(Qloo)]
  R --> C["compare<br/>compareTags"]
  R --> X["collide<br/>lib/collide.ts"]
  C -- "1" --> Q
  X -- "2 heatmaps" --> Q
```

A fully cold pair is 8 or 9 calls; a warm one is 0.

- **Rivals** (`lib/rivals.ts`, `GET /api/rivals?a=&ta=&b=&tb=`, label `rivals-v1`). Each side's top 50 brands, the union minus the two seeds, scored under both seeds with `filter.results.entities` in chunks of 50 (Qloo's `take` ceiling). A brand leans to a side at a gap of 0.05 or more, the review desk's tie width; everything else is shared. Brands sharing a second-level genre tag with either seed fold into a same-field group. A fully cold pair is 8 calls, run serially; each visitor gets ten cold pairs a day.
- **Compare** (`compareTags` in `lib/qloo.ts`). `/v2/insights/compare` returns tags only on this host, so it supplies the "Share by category" line and nothing else.
- **Collide** (`lib/collide.ts`). Both national heatmaps on Qloo's shared grid, each re-ranked to percentiles within the cells both carry, then diffed. A cell leans at a gap of 0.25; cells outside both sides' top half aren't drawn. Person seeds have flat heatmaps and get no map.
- **Rival finder** (`lib/rival.ts`, `GET /api/rival?a=&ta=`). The closest brand in the seed's top 50 that shares its second-level genre tag, then its Qloo product category, then three chips from the broader genre. Qloo's `competitor_brand` tags ride along as a second chip row, searched only when clicked. Artists and people get brand chips, never an automatic pair. It reads untrimmed tags (`fullTags`), 2 extra cached calls per seed.

## Architecture

![Crossover architecture: the browser streams /api/run over server-sent events; retrieval against Qloo is deterministic code; a ranking agent reviews each domain; a brief agent with four Qloo tools writes the brief; Upstash Redis caches every response.](docs/architecture.svg)

A run is one server-sent event stream. Code resolves the name, fetches six domains and the national heatmap from Qloo in parallel, and sends the slate as soon as it lands (about 6 s cold). The ranking agent then reviews each domain in parallel and streams its verdicts (about 18 s cold). Opening a pick starts a second stream: the brief agent, which calls Qloo through four tools. Every Qloo response and every model output is cached in Redis for 90 days under its arguments plus a prompt version, so a warm run returns in under a second and costs nothing.

## Every Qloo call

| Endpoint | Parameters | What it's for | File |
|---|---|---|---|
| `GET /search` | `query`, `types` (brand, artist, tv_show, movie, person), `take=5` | Candidates for a typed name | `lib/qloo.ts`, via `app/api/resolve/route.ts` |
| `GET /search` | `query`, `types=urn:entity:brand`, `take=5` | Checking stand-in brands for a brand Qloo doesn't know | `lib/proxy.ts` |
| `GET /v2/insights` | `filter.type`, `filter.results.entities`, `take=1` | One typed card for a share link, or a chosen id in the review desk | `lib/slate.ts` (`getCard`), `app/api/review/route.ts` |
| `GET /v2/insights` | `filter.type`, `signal.interests.entities` (the seed), `filter.results.entities` (every candidate of that type), `take` | The review desk's fixed-list score: one call per entity type | `lib/review.ts` (`scoreForward`) |
| `GET /v2/insights` | `filter.type` (the seed's type), `signal.interests.entities` (a candidate), `filter.results.entities` (the seed), `take=1` | Reverse affinity, only across types (same-type affinity is symmetric) | `lib/review.ts` (`scoreReverse`) |
| `GET /v2/insights` | `filter.type` (each of six domains), `signal.interests.entities`, `filter.exclude.entities`, `take=10`, `feature.explainability` | The slate | `lib/slate.ts` |
| `POST /v2/insights` | the same, with weighted stand-ins as `signal.interests.entities` and an optional brand-category `signal.interests.tags` | Slates for brands Qloo doesn't know | `lib/slate.ts`, `lib/qloo.ts` (`proxyBody`) |
| `GET/POST /v2/insights` | refine adds `filter.tags` with `operator.filter.tags=union`, `filter.exclude.tags`, `filter.popularity.min`, `signal.location.query` (POST place calls use `filter.location.query`), or `signal.interests.tags` as a soft fallback | Constraints from the Refine box | `lib/refine.ts`, `lib/slate.ts` |
| `GET/POST /v2/insights` | `filter.type=urn:heatmap`, `signal.interests.entities`, `filter.location.query=United States` | The national heatmap, aggregated to 55 markets | `lib/qloo.ts`, `lib/cities.ts` |
| `GET /v2/insights` | `filter.type`, `signal.interests.entities` (the partner), `take=50` | Where the seed lands among the partner's fans (the rank chips, the brief's reverse rank, pairing, the review desk's evidence from cache) | `lib/fit.ts` |
| `GET /v2/insights` | the same plus `filter.results.entities` (the seed), `take=1` | The raw affinity when the seed is outside that top 50 | `lib/fit.ts` |
| `GET/POST /v2/insights` | `filter.type=urn:entity:place`, `filter.location.query` (a market), `filter.tags` (restaurant, bar, live music venue, or cafe and coffee shop under a no-alcohol constraint), both entities as signals, `take=8` | Venues both audiences favor | `lib/agent/brief.ts` |
| `GET/POST /v2/insights` | `signal.demographics.age` (each of six brackets), `filter.results.entities` (the partner), `take=1` | "Who does this land with?" | `lib/cohort.ts` |
| `GET /v2/insights` | `bias.trends=off` and `very_high`, `take=10` | Trends comparison, off by default: on the hackathon API it changed nothing | `lib/trends.ts` |
| `GET /v2/tags` | `filter.query`, `filter.parents.types` | Turning refine phrases into tag ids | `lib/refine.ts`, `lib/qloo.ts` |
| `GET /v2/tags` | `filter.query`, `filter.parents.types=urn:entity:brand` or `urn:entity:place` | A stand-in run's brand category; venue category tags | `lib/proxy.ts`, `lib/agent/brief.ts` |
| `GET /v2/tags` | `filter.query` | The brief agent's tag lookup tool | `lib/agent/brief.ts` |
| `GET /v2/insights` | `filter.type=urn:entity:brand`, `signal.interests.entities` (each seed), `take=50` | Each side's top 50 for a rivals pair; the finder's candidate list | `lib/rivals.ts`, `lib/rival.ts` |
| `GET /v2/insights` | `filter.type=urn:entity:brand`, `signal.interests.entities` (each seed), `filter.results.entities` (up to 50 of the union), `take` | Scoring the union under both seeds | `lib/rivals.ts` (`getRivals`) |
| `GET /v2/insights/compare` | `a.signal.interests.entities`, `b.signal.interests.entities` | Shared category tags for "Share by category" | `lib/qloo.ts` (`compareTags`) |
| `GET /v2/insights` | `filter.type=urn:heatmap`, `signal.interests.entities`, `filter.location.query=United States` | The two heatmaps behind the collision map (same key as the single map) | `lib/rivals.ts`, `lib/collide.ts` |
| `GET /v2/insights` | the seed's card and top-50 params, tags kept untrimmed | Genre, product category and competitor tags for the rival finder | `lib/qloo.ts` (`fullTags`), `lib/rival.ts` |

`lib/qloo.ts` is the only file that talks to Qloo. It paces calls to four a second, retries once on 429 and 5xx, trims responses and counts every call against the daily cap.

## The honesty layer

- **Match validation** (`lib/resolve.ts`). Qloo's search returns confident wrong matches for names it doesn't know (Fruition Chocolate Works comes back as Bath & Body Works). A match is confident only on an exact name or alias above a popularity floor of 0.3 (the review desk adds a cross-type check; see above). Several exact hits keep Qloo's relevance order, and an artist beats a person with the same name. Token overlap becomes a picker, and Claude Haiku is asked only in the narrow band in between. The user always sees the card and can say "Not it". The resolver is tested against recorded search results for 22 names, 14 of them small brands Qloo doesn't know.
- **Stand-ins.** For a brand Qloo doesn't know, the user describes it and names brands their customers love. Haiku suggests more, and each is checked in Qloo. The slate is built from weighted stand-ins (10, 7, 5), and a banner says so on every screen.
- **Never rank by popularity.** Order is Qloo's affinity order, kept by code. The model reviews picks but cannot reorder them. Popularity is a floor for matching and, on the front door, a labelled reference column, never a correction.
- **Qloo's terms.** No raw Qloo responses in the repo (the audit publishes derived numbers), and no third-party logos or images in the app.
- **Say what didn't work.** Refine phrases that map to nothing are listed as "Couldn't apply". Kinds of partner without a Qloo tag ("no cookware") are applied by the ranker and labeled "Applied by the agent". A fit ranked in only one side's top 50 shows as such instead of being hidden.

## The agent design

Retrieval is code because Qloo's numbers are the evidence, and code makes the same calls the same way every time. Reasoning is the model's because judging fit, competitors, constraint breaks and a launch plan from those numbers is what a strategist does. The ranking agent may keep, demote, label a competitor, exclude by constraint or drop a pick, and every decision except keep needs a stated reason. It may not reorder picks, invent them or cite numbers it wasn't given. The brief agent may call four Qloo tools and stops if one fails rather than writing without evidence; outreach is drafted only after a person approves.

## Setup

Node 22 or later.

```
npm install
cp .env.example .env.local   # fill in the keys below
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `QLOO_API_KEY` | Hackathon key; works only against `https://hackathon.api.qloo.com` (5 requests a second, 10,000 a month) |
| `ANTHROPIC_API_KEY` | Claude Opus 5.5 (ranking, briefs, outreach, refine, verdicts) and Haiku 5.5 (match judge, stand-ins, age sentence) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis: the shared cache and the counters |
| `QLOO_DAILY_CAP` | Qloo calls allowed per UTC day across all instances (300 by default) |
| `WARM_TOKEN` | Optional: lets `scripts/warm.ts` keep its briefs off the per-visitor limit |
| `CROSSOVER_FORCE` | Development only: `qloo429,anthropic,novenues,noheatmap` force each failure path |

**Fixtures.** `fixtures/search.json` holds recorded `/search` results for the resolver tests (`node --env-file=.env.local scripts/record-fixtures.ts` re-records them). `fixtures/demo/` (gitignored, since it is Qloo data) holds the four example slates so local UI work spends no quota (`scripts/record-demo.ts`). In development, a file cache in `.cache/` sits in front of Redis.

**Warming.** `node --env-file=.env.local scripts/warm.ts <url> scripts/warm-list.json [--no-cohort]` runs resolve, the full slate, badges and the top brand's brief for each name, one at a time. It stops before the daily cap, logs Qloo calls per name, skips names that don't resolve confidently (or uses a hand-picked id recorded with a note), and records progress so it can resume.

**Why a daily cap.** The hackathon key has 10,000 calls a month, and one cold name costs about 15. The cap is counted in Redis across every serverless instance, so a burst of new names or a crawler can't spend the month. Each visitor also gets 20 new briefs a day; anything already generated is free. When either limit or the Anthropic balance runs out, the app says so plainly and points to the example brands.

## Tests

`npm test` runs 122 offline tests in about a second, with no API calls:

- match validation against recorded search results
- the review rules: missing data, leader-relative ties, selection, buyer gates, identity, request hygiene and share links
- ranking order and decisions
- refine constraint sets, including agent-applied categories and region handling
- market aggregation and the overlap between two audiences
- fit badges and pairing classes
- brief text parsing and the evidence-to-log mapping
- cohort brackets, trends classification and share-link checks
- failure classification
- rivals leans and same-field folds, the collision map, the rival finder and the vs payload
- a guard that no client component imports the server-only Qloo client

`npm run lint` and `npx tsc --noEmit` are clean.

## License

MIT, see [LICENSE](LICENSE). US state shapes: `data/us-states-10m.json` from [us-atlas](https://github.com/topojson/us-atlas) 3.0.1 (ISC).
