// Social preview cards (1200 x 630) in the site's own type: Newsreader on white, ink, hairline rule.
// The font comes from the Google Fonts CSS API (TTF for non-browser clients); if that fails the card still renders
// in next/og's default face.
import { ImageResponse } from "next/og";
import { Mark } from "@/lib/mark.tsx";

export const OG_SIZE = { width: 1200, height: 630 };
const INK = "#1b1716";
const INK_2 = "#514c49";
const RULE = "#e0dddc";

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[]> | null = null;
// the mono is for the front door card's trace rail (TR F12); the site's own mono is the system's, which a card can't load
export function loadFonts() {
  fonts ??= (async () => {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600&family=JetBrains+Mono:wght@400")).text();
    const faces = [...css.matchAll(/font-family:\s*'([^']+)';[\s\S]*?font-weight:\s*(\d+);[\s\S]*?src:\s*url\(([^)]+)\)/g)];
    return Promise.all(
      faces.map(async ([, name, w, url]) => ({ name, data: await (await fetch(url)).arrayBuffer(), weight: Number(w) as 400 | 600, style: "normal" as const })),
    );
  })().catch(() => {
    fonts = null; // try again next time
    return [];
  });
  return fonts;
}

export async function ogCard({ title, line, rail }: { title: string; line?: string; rail?: string[] }) {
  // a Pick three seed may be 100 characters (review-share MAX_LEN): past 70 the title steps down once more so the
  // lines and the picks line stay off the header rule and the footer (WILD-F8, real Oct 21)
  const size = title.length > 70 ? 56 : title.length > 34 ? 72 : 88;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", padding: "64px 80px", fontFamily: "Newsreader", color: INK }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 36, fontWeight: 600, paddingBottom: 20, borderBottom: `2px solid ${RULE}` }}><Mark size={32} />Crossover</div>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: size, fontWeight: 600, lineHeight: 1.05, maxWidth: 1000 }}>{title}</div>
          {line && <div style={{ display: "flex", marginTop: 28, fontSize: 36, fontWeight: 400, color: INK_2 }}>{line}</div>}
        </div>
        {rail && (
          <div style={{ display: "flex", flexWrap: "wrap", columnGap: 28, rowGap: 6, marginBottom: 24, fontFamily: "JetBrains Mono", fontSize: 24, color: INK_2 }}>
            {rail.map((r, i) => <div key={r} style={{ display: "flex" }}>{`${i + 1} ${r}`}</div>)}
          </div>
        )}
        <div style={{ display: "flex", fontSize: 28, fontWeight: 400, color: INK_2 }}>Built on Qloo&apos;s taste graph</div>
      </div>
    ),
    { ...OG_SIZE, ...((f) => (f.length ? { fonts: f } : {}))(await loadFonts()) },
  );
}

// The /vs share card: the collision map on the left, the pair, the markets line and the legend on the right.
// labels: text placed over the image in its own 688 x 430 box (text inside an SVG data URI isn't rendered by the card)
export async function ogMapCard({ title, line, svg, legend, labels = [] }: { title: string; line: string | null; svg: string; legend: { color: string; label: string }[]; labels?: { x: number; y: number; text: string }[] }) {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", padding: "40px 56px", fontFamily: "Newsreader", color: INK }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30, fontWeight: 600, paddingBottom: 14, borderBottom: `2px solid ${RULE}` }}><Mark size={27} />Crossover</div>
        <div style={{ display: "flex", flexGrow: 1, alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", position: "relative", width: 688, height: 430 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} width={688} height={430} alt="" />
            {labels.map((l) => (
              <div key={l.text} style={{ display: "flex", position: "absolute", left: l.x, top: l.y - 13, fontSize: 20, color: INK, fontFamily: "Newsreader" }}>
                {l.text}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexShrink: 1, width: 360 }}>
            <div style={{ display: "flex", fontSize: title.length > 24 ? 44 : 54, fontWeight: 600, lineHeight: 1.05 }}>{title}</div>
            {line && <div style={{ display: "flex", marginTop: 18, fontSize: 24, color: INK_2, lineHeight: 1.3 }}>{line}</div>}
            <div style={{ display: "flex", flexDirection: "column", marginTop: 22, gap: 8 }}>
              {legend.map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, color: INK_2 }}>
                  <div style={{ display: "flex", width: 16, height: 16, borderRadius: 8, background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: INK_2 }}>Built on Qloo&apos;s taste graph</div>
      </div>
    ),
    { ...OG_SIZE, ...((f) => (f.length ? { fonts: f } : {}))(await loadFonts()) },
  );
}
