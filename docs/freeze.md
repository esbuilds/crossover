# Prompt freeze, Oct 23

Every model output Crossover shows is cached in Redis under a label. The label is part of the cache key, so changing a
prompt without bumping its label serves stale output, and bumping a label makes every cached output under it cold
(the next visitor pays the Qloo calls and the wait). These are the labels frozen for judging.

| What | Label | Where | Model |
|---|---|---|---|
| Ranking, unrefined slates | `rank-v3.2` | `lib/agent/rank.ts` `PROMPT_VERSION` | Opus 5.5, effort medium |
| Ranking, refined slates | `rank-v3.5` | `lib/agent/rank.ts` `REFINED_VERSION` | Opus 5.5, effort medium |
| Brief, unrefined | `brief-v4.3` | `lib/agent/brief.ts` | Opus 5.5, effort medium |
| Brief, refined (skips venues that break a constraint) | `brief-v4.4` | `lib/agent/brief.ts` | Opus 5.5, effort medium |
| Outreach email | `outreach-v2.1` | `lib/agent/outreach.ts` | Opus 5.5, effort medium |
| Refine interpretation | `refine-v4` | `lib/refine.ts` | Opus 5.5, effort medium |
| Pairing verdict | `pair-v3` | `lib/pairing.ts` | Opus 5.5, effort medium |
| Inbound triage table | `triage-v3` | `lib/agent/triage.ts` | Opus 5.5, effort medium |
| Age cohort sentence | `cohort-v2` | `lib/cohort.ts` | Haiku 5.5, effort low |
| Proxy stand-in proposals | `proxies-v5` | `lib/proxy.ts` | Haiku 5.5, effort low |
| Trends lists (feature off, `CROSSOVER_TRENDS=on` to enable) | `trends-v1` | `lib/trends.ts` | none (Qloo only) |

Notes:

- Oct 11 (Eric approved via the planner): brief-v4.1/v4.2 became v4.3/v4.4, pair-v2 became pair-v3, triage-v2 became
  triage-v3. The prompts now state rank facts ("#n among X fans' brands") instead of direction words ("fans love
  X, not the reverse", "like the seed back"), because Qloo's same-type affinity is symmetric. The scorecard line
  "Mutual fit" is now "Ranked both ways"; the UI reads either, since older cached briefs keep the old label.

- `brief-v4.1` briefs cached before Oct 23 were written when the venue tool returned five venues; fresh ones see eight
  with their tags. The prompt text is otherwise the same, so the label was not bumped and the demo briefs stay warm.
- Qloo responses are cached under their own request parameters, not under these labels, so a label bump usually costs
  Anthropic calls only, plus Qloo calls wherever the new prompt makes the model ask for something new.

## The rule

Changing any prompt or label above after Oct 23 needs Eric's yes first, and the same day a re-warm of everything the
change makes cold: the four chips, the demo refines (Liquid Death Texas, Mt. Joy West Coast, Graza Northeast), the four
demo pairings, the demo briefs and their cohorts, and the warm list in `scripts/warm.ts`. Check `/api/usage` before and
after, and open production in a browser after the deploy.

## Front door since Pick A (real Oct 13)

The home page replays the first prepared ask (Mt. Joy, lib/ask/prepared.ts) from the cache on the server; it is the freeze item that replaces the home pair. Re-warm with `WARM_TOKEN=... node scripts/ask-warm.ts <baseUrl>` and confirm "cached true, 0 Qloo calls" for every prepared ask. Liquid Death vs Celsius stays warm as /vs's first pair.

## Display names (real Oct 13)

The ask page and its share card show a display name only where Qloo's entity name is a single generic word, and the display name comes from Qloo's own description of that entity. The checker always matches Qloo's names; the map is render-only (lib/ask/check.ts, `DISPLAY`). Keep it tiny; every entry is listed here.

| Qloo id | Qloo name | Shown as | Source |
|---|---|---|---|
| 26B1E073-D09A-4242-AD7F-EED546CE55A7 | Alternative | Alternative Apparel | Qloo's description: "Alternative Apparel is a sustainable clothing brand" |

## Answer freeze (real Oct 14, Fable)

Prompts and tools change no more before submit. The cached answers below are the frozen answers: captions, the gallery, the shotlist and the script come from them. extend-ttl pinned every cached key to 2026-12-01 on Oct 14 (2,902 keys) and runs again on Oct 22; Oct 22 verifies these hashes with `node --env-file=.env.local scripts/ask-hashes.ts` and does not re-warm. Liquid Death's stale ask key was forgotten on Oct 14.

| Ask | sha1 of cached events | Calls | Checker |
|---|---|---|---|
| Allbirds | 1db3003687a633fa32d4f348c16b5cfc7d67abb1 | Bombas, Warby Parker, ClassPass | ok |
| Mt. Joy | 79a549bdd8b0838452c3f15c5382ee4c3d7837db | Outdoor Voices, Allbirds, Alternative | ok |
| Coca-Cola x Converse (replay) | 793443bbad52952543f781567872fde57721d9e6 | Converse, Vans | ok |

Any fix that would touch a tool or the prompt reopens the freeze and needs a ruling first.

## First change after judging ends (Nov 16)

The checker's score-binding rule reads the clause after the first brand named as that brand's own numbers, so three true sentences were blocked ("with seven others between 0.94 and 0.95", "within 0.05", a group range). Refine it to end the clause at a boundary ("with", "while", a comma). Not before submit: a strict rule that blocks true sentences is the safe failure on camera; a looser one could pass a wrong binding.

- tools.ts:154 collapses "never fetched" (undefined) and "not in top 50" (null) ranks into null; fix after Nov 16 (Fable columns ruling, Oct 15). The both-ways block reads ranks itself.

- check.ts rule v2, real Oct 15 (Fable judge-probe ruling, Eric approved): a contrast marker ends the first brand's number segment. Gates: frozen three identical, 29 passing cached asks still pass, real failures still block, leak test. Re-checked on render (lib/ask/steps.ts decisionEvent); stored events and hashes unchanged.
- First tool change after Nov 16: the candidates filter should also cut by Qloo category and by a seed's top-level genre when it has no specific one (Chipotle/MOD Pizza, Dodgers/NFL; /audit#judge-names).

- First prompt change after Nov 16 (Fable persona round 2 ruling): the agent reads the both-ways reverse rank before it chooses (Tyler Childers: Shinesty fans don't have him in their top 50).
- Tool change after Nov 16: a popularity floor or tour-sponsor source for artist seeds' candidates (artist answers lead with small DTC apparel; persona round 2, Live Nation).

## Freeze checklist additions (Oct 15)
- Recount routes (node --env-file=.env.local scripts/routes.ts) and update the dated count on /audit (routes entry, funnel strip), README and devpost-v7 final.
