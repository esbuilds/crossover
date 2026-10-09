// The brief prompt pins its format ("## " headings, "- " bullets, "Market: " and "Venue: " lines), so the panel
// can lay it out as sections, a scorecard, figures and venue rows. Pure, runs in the browser, works on partial
// text while it streams.

export type Section = { heading: string; paras: string[]; bullets: string[] };

export function sections(text: string): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (l.startsWith("## ")) out.push((cur = { heading: l.slice(3).trim(), paras: [], bullets: [] }));
    else if (!l) continue;
    else {
      cur ??= (out.push({ heading: "", paras: [], bullets: [] }), out[0]);
      if (l.startsWith("- ")) cur.bullets.push(l.slice(2));
      else cur.paras.push(l);
    }
  }
  return out;
}

// "Audience affinity: Fallen is #3..." -> label and body. Only short, word-only labels count.
export function labelled(bullet: string): { label: string | null; body: string } {
  const m = /^([A-Za-z][A-Za-z ]{1,24}):\s+(.*)$/.exec(bullet);
  return m ? { label: m[1], body: m[2] } : { label: null, body: bullet };
}

// Evidence lines lead with a figure: "Affinity 0.87 at slate rank #3: Liquid Death's fans..." or
// "0.87 forward affinity at #1 on the slate. Liquid Death fans...". The lead is set as a figure when it is short and
// has a number in it.
// A sentence end, not an abbreviation ("Dr. Squatch", "Mt. Joy", "Sunset Blvd.").
const STOP = String.raw`(?<!\b(?:Dr|Mr|Mrs|Ms|Mt|St|Co|Inc|Jr|Sr|vs|Ave|Blvd))\.\s`;
const LEAD = new RegExp(String.raw`^(.{3,70}?)(?::\s|${STOP})(.*)$`);
const HEAD = new RegExp(String.raw`^(.+?)${STOP}(.*)$`);

export function figureLead(bullet: string): { lead: string | null; rest: string } {
  const m = LEAD.exec(bullet);
  return m && /\d/.test(m[1]) ? { lead: m[1], rest: m[2] } : { lead: null, rest: bullet };
}

// "Whisky a Go Go, West Hollywood. A Sunset Strip rock venue..." -> name (and area), rest.
export function venueLine(body: string): { name: string; area: string | null; rest: string } {
  const m = HEAD.exec(body);
  const head = (m ? m[1] : body).replace(/\s*\([^)]*\)/g, ""); // "(affinity 0.917)": the panel shows the figure itself
  const [name, ...area] = head.split(", ");
  return { name, area: area.join(", ") || null, rest: m ? m[2] : "" };
}

// The reverse rank in the mutual-fit line, for the scorecard figure.
export function reverseFigure(body: string): string | null {
  const rank = /#(\d+)\b/.exec(body);
  if (rank) return `#${rank[1]} of 50 for their fans`;
  if (/not in .*top 50/i.test(body)) return "Outside their top 50";
  return null;
}

// The log line behind an evidence claim, for the hover: reverse-rank claims come from the "like you back" check,
// market claims from the heatmap overlap, venue claims from the venue lookup.
export function sourceFor(bullet: string, trace: string[]): string | null {
  const find = (re: RegExp) => trace.find((t) => re.test(t)) ?? null;
  if (/revers|their fans|top.?50|top.?10|like .* back/i.test(bullet)) return find(/isn't in|is #\d+ among/) ?? find(/like .* back/); // the result line over the "Checking" line
  if (/market|over-index|run hot|\b1\d\d\b/i.test(bullet)) return find(/run hot|markets where both/);
  if (/venue/i.test(bullet)) return find(/^Found \d+ venues|venues in/);
  if (/slate|affinity/i.test(bullet)) return "Qloo insights: the seed's slate, the brands its fans over-index on";
  return null;
}
