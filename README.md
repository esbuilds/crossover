# Crossover

Type a brand, artist, show or person, and Crossover shows who that audience already loves across Qloo's taste graph (brands, artists, TV shows, films, podcasts and places), the US markets where those fans over-index, and a one-page partnership brief with the evidence and a launch plan. A human approves before any outreach is drafted. Every number on screen comes from a Qloo response, and the product says so when a fit is one-way or a constraint couldn't be applied. Built for the Qloo Agentic Hackathon (2026).

## The 30-second path

1. Open https://crossover-henna.vercel.app and click **Liquid Death**.
2. Read the brands row: each pick has Qloo's affinity bar, the agent's one-line reason, and a Mutual or Partial chip when that brand's fans rank Liquid Death back. The map and market list sit below.
3. Click **Dr. Squatch Soap Co.** for the brief: the scorecard, the evidence, a launch market with venues, and a chart of who it lands with by age.
4. Type `no alcohol or cannabis partners, Texas only` into **Refine** and watch the slate re-plan.

## Architecture

![Crossover architecture: the browser streams /api/run over server-sent events; retrieval against Qloo is deterministic code; a ranking agent reviews each domain; a brief agent with four Qloo tools writes the brief; Upstash Redis caches every response.](docs/architecture.svg)

A run is one server-sent event stream. Code resolves the name, fetches six domains and the national heatmap from Qloo in parallel, and sends the slate as soon as it lands (about 6 s cold). The ranking agent then reviews each domain in parallel and streams its verdicts (about 18 s cold). Opening a pick starts a second stream: the brief agent, which calls Qloo through four tools. Every Qloo response and every model output is cached in Redis for 90 days under its arguments plus a prompt version, so a warm run returns in under a second and costs nothing.

## Every Qloo call

| Endpoint | Parameters | What it's for | File |
|---|---|---|---|
| `GET /search` | `query`, `types` (brand, artist, tv_show, movie, person), `take=5` | Candidates for a typed name | `lib/qloo.ts`, via `app/api/resolve/route.ts` |
| `GET /search` | `query`, `types=urn:entity:brand`, `take=5` | Checking stand-in brands for a brand Qloo doesn't know | `lib/proxy.ts` |
| `GET /v2/insights` | `filter.type`, `filter.results.entities`, `take=1` | One typed card for a share link | `lib/slate.ts` (`getCard`) |
| `GET /v2/insights` | `filter.type` (each of six domains), `signal.interests.entities`, `filter.exclude.entities`, `take=10`, `feature.explainability` | The slate | `lib/slate.ts` |
| `POST /v2/insights` | the same, with weighted stand-ins as `signal.interests.entities` and an optional brand-category `signal.interests.tags` | Slates for brands Qloo doesn't know | `lib/slate.ts`, `lib/qloo.ts` (`proxyBody`) |
| `GET/POST /v2/insights` | refine adds `filter.tags` with `operator.filter.tags=union`, `filter.exclude.tags`, `filter.popularity.min`, `signal.location.query` (POST place calls use `filter.location.query`), or `signal.interests.tags` as a soft fallback | Constraints from the Refine box | `lib/refine.ts`, `lib/slate.ts` |
| `GET/POST /v2/insights` | `filter.type=urn:heatmap`, `signal.interests.entities`, `filter.location.query=United States` | The national heatmap, aggregated to 55 markets | `lib/qloo.ts`, `lib/cities.ts` |
| `GET /v2/insights` | `filter.type`, `signal.interests.entities` (the partner), `take=50` | Where the seed lands among the partner's fans (Mutual and Partial chips, the brief's reverse check, pairing) | `lib/fit.ts` |
| `GET /v2/insights` | the same plus `filter.results.entities` (the seed), `take=1` | The raw affinity when the seed is outside that top 50 | `lib/fit.ts` |
| `GET/POST /v2/insights` | `filter.type=urn:entity:place`, `filter.location.query` (a market), `filter.tags` (restaurant, bar, live music venue, or cafe and coffee shop under a no-alcohol constraint), both entities as signals, `take=8` | Venues both audiences favor | `lib/agent/brief.ts` |
| `GET/POST /v2/insights` | `signal.demographics.age` (each of six brackets), `filter.results.entities` (the partner), `take=1` | "Who does this land with?" | `lib/cohort.ts` |
| `GET /v2/insights` | `bias.trends=off` and `very_high`, `take=10` | Trends comparison, off by default: on the hackathon API it changed nothing | `lib/trends.ts` |
| `GET /v2/tags` | `filter.query`, `filter.parents.types` | Turning refine phrases into tag ids | `lib/refine.ts`, `lib/qloo.ts` |
| `GET /v2/tags` | `filter.query`, `filter.parents.types=urn:entity:brand` or `urn:entity:place` | A stand-in run's brand category; venue category tags | `lib/proxy.ts`, `lib/agent/brief.ts` |
| `GET /v2/tags` | `filter.query` | The brief agent's tag lookup tool | `lib/agent/brief.ts` |

`lib/qloo.ts` is the only file that talks to Qloo. It paces calls to four a second, retries once on 429 and 5xx, trims responses and counts every call against the daily cap.

## The honesty layer

- **Match validation** (`lib/resolve.ts`). Qloo's search returns confident wrong matches for names it doesn't know (Fruition Chocolate Works comes back as Bath & Body Works). A match is confident only on an exact name or alias above a popularity floor of 0.3. Several exact hits keep Qloo's relevance order, and an artist beats a person with the same name. Token overlap becomes a picker, and Claude Haiku is asked only in the narrow band in between. The user always sees the card and can say "Not it". The resolver is tested against recorded search results for 22 names, 14 of them small brands Qloo doesn't know.
- **Stand-ins.** For a brand Qloo doesn't know, the user describes it and names brands their customers love. Haiku suggests more, and each is checked in Qloo. The slate is built from weighted stand-ins (10, 7, 5), and a banner says so on every screen.
- **Never rank by popularity.** Order is Qloo's affinity order, kept by code. The model reviews picks but cannot reorder them. Popularity is only a floor for matching.
- **Say what didn't work.** Refine phrases that map to nothing are listed as "Couldn't apply". Kinds of partner without a Qloo tag ("no cookware") are applied by the ranker and labeled "Applied by the agent". One-way fits show as One way instead of being hidden.

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

`npm test` runs 62 offline tests in about a second, with no API calls:

- match validation against recorded search results
- ranking order and decisions
- refine constraint sets, including agent-applied categories and region handling
- market aggregation and the overlap between two audiences
- fit badges and pairing classes
- brief text parsing and the evidence-to-log mapping
- cohort brackets, trends classification and share-link checks
- failure classification
- a guard that no client component imports the server-only Qloo client

`npm run lint` and `npx tsc --noEmit` are clean.

## License

MIT, see [LICENSE](LICENSE). US state shapes: `data/us-states-10m.json` from [us-atlas](https://github.com/topojson/us-atlas) 3.0.1 (ISC).
