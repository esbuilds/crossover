# Crossover

Type a brand, artist, show, or person, and Crossover shows what its fans over-index on across Qloo's taste graph: brands, artists, TV, films, podcasts, and places, plus the US markets where that audience runs hottest. It's built to answer "who should we collab with, and where should we launch it?" with evidence instead of guesswork. Built for the Qloo Agentic Hackathon (2026).

Live: https://crossover-henna.vercel.app

## Run it

Node 22 or later.

```
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev                  # http://localhost:3000
npm test                     # offline tests, no API calls
```

## Env vars

- `QLOO_API_KEY`: Qloo hackathon key. It works only against `https://hackathon.api.qloo.com` and is limited to 5 requests per second and 10,000 per month; the client stays at 4 per second.
- `ANTHROPIC_API_KEY`: used for match validation (Claude Haiku 5.5) when a typed name only partly matches Qloo's results. Without it, those borderline matches are shown to the user to pick from instead.

## Fixtures

Two kinds, both recorded from the live API:

- `fixtures/search.json` (committed): `/search` results for 20 test brands, trimmed to name, id, types, popularity, and description. The match validation test runs against it.
  Re-record: `node --env-file=.env.local scripts/record-fixtures.ts` (20 Qloo calls).
- `fixtures/demo/` (gitignored, because it holds Qloo response data): resolve, slate, and heatmap for the four demo entities. In development, `/api/resolve` and `/api/slate` serve these instead of calling Qloo, so UI work spends no quota.
  Record: `node --env-file=.env.local scripts/record-demo.ts` (about 32 Qloo calls).

## How it works

- `lib/qloo.ts`: the only code that calls Qloo. Rate limiting, one retry on 429, trimmed responses, 30-day cache.
- `lib/resolve.ts`: match validation. Qloo's search returns confident wrong matches for brands it doesn't know, so exact and token matches are checked first and a model is asked only for borderline cases.
- `lib/slate.ts`: the partner slate across six Qloo domains.
- `lib/cities.ts` and `data/metros.json`: the US heatmap aggregated to 55 markets, scored as over-index vs. the national average.
- `GET /api/resolve?q=`, `GET /api/slate?entity=`, `GET /api/usage`.

US state shapes: `data/us-states-10m.json` from [us-atlas](https://github.com/topojson/us-atlas) 3.0.1 (ISC).

## License

MIT
