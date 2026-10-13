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
