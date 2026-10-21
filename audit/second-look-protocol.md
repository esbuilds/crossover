# The second look: gates (look-v1, AGENT-1 with AGENT-4 and AGENT-6)

Drafted real Oct 22, 2026 (UTC Oct 21). Committed before any Qloo or model call for this test. Nothing below changes after this commit; results are published either way.

## What it is

A second run beside a cached ask, never instead of it (lib/ask/second.ts, POST /api/ask/second, cache family `look-v1`). The agent reads the frozen steps and decision; it may call `otherWay` (for candidate names, where each one's own fans rank the seed in their top 50 of the seed's type; the same parameters lib/ask/both-ways.ts uses) up to twice, then `decide` (up to three calls) or `decline` (no call, one cited sentence). The checker (lib/ask/check.ts, rule v3, unchanged) runs on the answer; a "no" goes back to the agent once as a visible "check" event, and the second answer is final. The frozen answer stays the answer of record; its cache key, prompt, tools and hashes are untouched.

Outcome, by code: kept (same calls, same order), changed (anything else with at least one call), declined (no calls, checked), blocked (the final answer fails the checker).

## Gate A (done, 0 calls)

The first measurement tied ("no clear three") in at least 25 of the decided asks. Result: 34 of 36, and the agent called through the tie in all 34 (scripts/forks.ts over every cached ask, reproducing the agent lane's agency-probe.mjs; audit/forks.json).

## Gate B: the 14 replay v2 cases (UTC Oct 23)

Cases, in file order, with the protocol's rank for the real partner: Doritos x Netflix 5, Doritos x Twitch 6, McDonald's x Pacsun 3, Nike x Netflix 3, Ben & Jerry's x Nike 1, Krispy Kreme x Crocs 1, Spotify x Reebok 5, Goldfish x Dunkin' 1, Coca-Cola x Converse 1, Pringles x Crocs 1, Jack in the Box x The Hundreds 1, Sour Patch Kids x Under Armour 2, The North Face x Jeep 1, Dunkin' x Urban Outfitters 2.

- Coca-Cola x Converse uses its cached live case ask. The other 13 first run the frozen case prompt (lib/ask/agent.ts, unchanged prompt and tools) under the script-only cache family `ask-script`, with the case's eight sorted by name, never a live key. Then the second look runs on each.
- PASS: the real partner is among the second look's calls in at least 11 of 14, and no case the protocol ranked 1st ends declined.
- Kill: FAIL publishes a failed probe row on /audit; the block is not offered for mounting.

Read with the replay control (audit/replay-control-protocol.md, failed Oct 22: scrambled seeds hit 17 of 23, the same as the real seeds). Keeping the real partner is therefore a check that the second look doesn't lose what the first run had, not evidence that it reads the seed's fans. Reported, not gated: for every case where the look ran `otherWay` on the real partner, where the partner's fans rank the seed, beside the decoys it measured. That direction is specific to the seed, which the first direction turned out not to be.

## Gate C: the cached seeds (UTC Oct 24)

The distinct seeds with an ask cached under the current version (ask-v1.6+t2), from audit/forks.json: Allbirds, Calm, Cedric the Entertainer, Chipotle, Dove, Dr. Squatch Soap Co., Los Angeles Dodgers, Mt. Joy, Noah Kahan, Oatly, Olipop, Patagonia, Sweetgreen, Taylor Swift, Tyler Childers, YETI. The agent lane counted 22; Liquid Death, HOKA and Playstation are cached only under older versions, and Coca-Cola is the case ask in Gate B.

- PASS: at least 14 of 16 end checked (kept, changed or declined), the lane's 18 of 22 scaled up, and the three frozen hashes (scripts/ask-hashes.ts) are unchanged after.
- Counted: kept, changed, declined, blocked, how many measured the other way.

## AGENT-4: the checker's no

Counted separately in both gates: answers the checker sent back, and of those, any that passed the second time with fewer names and numbers and no new measurement in between ("cited less"). Cited-less passes are reported as the honest failure mode, not as fixes.

## AGENT-6: "What the agent decided, counted"

An /audit row with audit/forks.json's counts and the second look's, shipped only if Gate B passes.

## Budget

Gate B: about 13 case asks at roughly 20 Qloo calls each, plus up to 16 `otherWay` calls per case, under 480; 27 Opus runs. Gate C: up to 16 calls per seed where the reverse lists aren't cached, under 260; 16 Opus runs. `/api/usage` logged before and after each run; the 600-a-day cap and the 3,000-call judging reserve hold.

## Note before Gate C (real Oct 22, UTC Oct 21; Eric's ruling)

Gate B was not run. The replay control failed (audit/replay-control-protocol.md: scrambled seeds 17 of 23, real 17), so keeping the real partner wouldn't show taste; the reverse replay (audit/replay-reverse-protocol.md) measured the other direction directly instead, and failed too (5 of 23, bar 13). Gate C runs as written above, bar 14 of 16, on the next UTC day, at most 260 Qloo calls. The checker the second look uses is now rule v3.1 (df63965: a rank ending a sentence is bound too). AGENT-6's /audit row ships on Gate C's numbers, pass or fail.
