# Historical replay protocol, second round (replay-v2)

Drafted real Oct 13, 2026, after replay-v1 failed its bar (6 of 9 in the top three, needed 7; frozen 9b64c6c). Adding cases after a miss can flatter a result, so v2 is a separate test with its own bar, on new cases only, and v1 stays on /audit beside it, unchanged. Frozen in git before stage 2 runs.

## What carries over from v1 (audit/replay-protocol.md), unchanged

Identity rule, decoy rule (the partner's most specific Qloo brand genre tag, the seven brands under it closest in popularity, no affinity read), one scoring call per case, hit = real partner in the top three of eight, pass = the smallest hit count with one-sided binomial probability under 0.05 at a chance of 3 in 8, printed before any result. Secondary numbers reported, not part of the bar: mean rank against 4.5, top-group membership, popularity rank.

## What's new

- Cases: audit/replay-v2-cases.json, sourced fresh (each with a public URL); no pair, seed-partner order or partner from v1's scored cases is reused as a case. Partners were chosen from categories where Qloo carries clean brand tags (restaurants, snacks, drinks, alcohol, apparel, streaming and apps, beauty, cars), because v1 lost four cases to partners with no tag.
- Decoy check written down before the build: a case is dropped, not fixed, when the partner's tag is named "Other", when the tag names a product the partner isn't known for (v1: Apple as Headphones, Adidas as Basketball), or when a decoy is the partner's own parent or subsidiary. Eric reads the built lists and applies this check before the freeze; no decoy is hand-edited.
- Pooled v1 + v2 numbers may be shown for context, labelled as pooled after the fact, never as the bar.

## Reporting

As v1: every case, hit or miss, with its eight names and source, plus every dropped case and why, on /audit. A fail is published the same way as a pass.

## Case list (locked before any build)

24 cases in audit/replay-v2-cases.json, sourced by a research agent with a URL each. Left out before locking: Reese's x Reebok (announced for Oct 20, 2026, not yet released).
