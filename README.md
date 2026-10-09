# Crossover

Put in a brand, artist, show, or person. Get back the partners its fans over-index on across every Qloo domain, the cities to launch in, and a brief for each pick backed by the taste evidence. Built for the Qloo Agentic Hackathon (2026).

Work in progress. The full write-up (architecture, every Qloo endpoint and why) comes before submission.

## Setup

```
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev
```

Env vars:

- `QLOO_API_KEY`: Qloo hackathon key (works only against `https://hackathon.api.qloo.com`)
- `ANTHROPIC_API_KEY`: used for match validation (Claude Haiku 5.5) and the agent (Claude Opus 5.5). Optional for now; without it, borderline name matches are shown to the user instead of checked by the model.

## Tests

```
npm test
```

Runs match validation against recorded search results in `fixtures/` (no API calls).

## License

MIT
