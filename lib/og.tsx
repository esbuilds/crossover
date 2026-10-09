// Social preview cards (1200 x 630) in the site's own type: Newsreader on white, ink, hairline rule.
// The font comes from the Google Fonts CSS API (TTF for non-browser clients); if that fails the card still renders
// in next/og's default face.
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
const INK = "#1b1716";
const INK_2 = "#514c49";
const RULE = "#e0dddc";

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= (async () => {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600")).text();
    const faces = [...css.matchAll(/font-weight:\s*(\d+);[\s\S]*?src:\s*url\(([^)]+)\)/g)];
    return Promise.all(
      faces.map(async ([, w, url]) => ({ name: "Newsreader", data: await (await fetch(url)).arrayBuffer(), weight: Number(w) as 400 | 600, style: "normal" as const })),
    );
  })().catch(() => {
    fonts = null; // try again next time
    return [];
  });
  return fonts;
}

export async function ogCard({ title, line }: { title: string; line?: string }) {
  const size = title.length > 34 ? 72 : 88;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", padding: "64px 80px", fontFamily: "Newsreader", color: INK }}>
        <div style={{ display: "flex", fontSize: 36, fontWeight: 600, paddingBottom: 20, borderBottom: `2px solid ${RULE}` }}>Crossover</div>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: size, fontWeight: 600, lineHeight: 1.05, maxWidth: 1000 }}>{title}</div>
          {line && <div style={{ display: "flex", marginTop: 28, fontSize: 36, fontWeight: 400, color: INK_2 }}>{line}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 400, color: INK_2 }}>Built on Qloo&apos;s taste graph</div>
      </div>
    ),
    { ...OG_SIZE, ...((f) => (f.length ? { fonts: f } : {}))(await loadFonts()) },
  );
}
