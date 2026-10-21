// Replay control, scrambled seeds (audit/replay-control-protocol.md, frozen 7f32e44): the /audit paragraph, every
// number read from audit/replay-control.json and the frozen replay files.
type Row = { realRank: number; scrambledRank: number | null; hit: boolean };
type Control = { summary: { cases: number; realHits: number; scrambledHits: number; noMeasurement: number; pass: boolean; meanScrambledRank: number }; cases: Row[] };

export const CONTROL_FREEZE = "7f32e44";

export function controlSentences(c: Control, v2From = 9) {
  const s = c.summary;
  const v2 = c.cases.slice(v2From);
  const two = (v: number) => (Math.round(v * 100) / 100).toFixed(2);
  const realMean = c.cases.reduce((a, r) => a + r.realRank, 0) / c.cases.length;
  const moved = c.cases.reduce((a, r) => a + ((r.scrambledRank ?? 0) - r.realRank), 0);
  return [
    `Scrambled seeds: each case's frozen eight scored again under a different case's seed, drawn by rule before any call. ${s.pass ? "It passes" : "It fails its bar"}: the real partner landed in the top three ${s.scrambledHits} times in ${s.cases} under the wrong seed's fans, against ${s.realHits} under its own (the bar was ${Math.min(12, s.realHits - 4)} or fewer).`,
    `For the second test alone, ${v2.filter((r) => r.hit).length} of ${v2.length} against ${v2.filter((r) => r.realRank <= 3).length}. The mean rank went from ${two(realMean)} to ${two(s.meanScrambledRank)}; the right seed moved the real partner up ${moved} places in total across the ${s.cases}.`,
    s.pass ? "" : `As the protocol said before the run, that means the eights favor the real partner whoever is asking: most of the replay's hits come from how the lists were built, not from the seed's fans.${s.noMeasurement ? ` ${s.noMeasurement} had no measurement and counted against the test.` : ""}`,
  ].filter(Boolean);
}

// The second test's cases are the last 14 rows (the draw runs v1's nine, then v2's). The /replay sentence and the strip's
// title (Eric's PROOF-1 wording ruling, real Oct 22): the v2 count, then the same cases under the scrambled seeds.
export const scrambledV2Hits = (c: Control, v2From = 9) => c.cases.slice(v2From).filter((r) => r.hit).length;
export const replayLine = (v2: { hits: number; scored: number }, scrambled: number) =>
  `Qloo's data put the real partner in its top three ${v2.hits} times in ${v2.scored}. With the wrong seed brand swapped in, it still did ${scrambled} times, so these lists favor the real partner whoever is asking.`;
