// GET /replay/strip/1200 (the 3:2 gallery thumbnail, 1200 x 800) and /replay/strip/1920 (Nov 5, 1920 x 1080): the deal
// strip (lib/og-strip.ts). Built at build time from the audit files: 0 Qloo calls, no cache read.
import { ImageResponse } from "next/og";
import { loadFonts } from "@/lib/og.tsx";
import { stripBlocks, stripTitle, type StripBlock } from "@/lib/og-strip.ts";

const SIZES: Record<string, { width: number; height: number }> = { "1200": { width: 1200, height: 800 }, "1920": { width: 1920, height: 1080 } };
export const generateStaticParams = () => Object.keys(SIZES).map((size) => ({ size }));

const INK = "#1b1716", INK_2 = "#514c49", INK_3 = "#6b6562", RULE = "#e0dddc", RULE_STRONG = "#c8c4c2", ACCENT = "#bd4510";

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = SIZES[(await params).size];
  if (!size) return new Response("Not found", { status: 404 });
  const { width, height } = size;
  const s = Math.min(width / 1200, height / 800); // one layout, scaled; the 1920 frame centres it
  const px = (n: number) => Math.round(n * s);
  const dot = px(20), gap = px(11), label = px(270);
  const Block = ({ b }: { b: StripBlock }) => (
    <div style={{ display: "flex", flexDirection: "column", width: px(520) }}>
      <div style={{ display: "flex", fontSize: px(22), fontWeight: 600, color: INK, marginBottom: px(12) }}>{b.label}</div>
      <div style={{ display: "flex", marginLeft: label, marginBottom: px(6), fontFamily: "JetBrains Mono", fontSize: px(14), color: INK_3 }}>
        {Array.from({ length: 8 }, (_, i) => <div key={i} style={{ display: "flex", justifyContent: "center", width: dot, marginRight: i === 2 ? gap * 2 + 1 : gap }}>{i + 1}</div>)}
      </div>
      {b.rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", height: px(32) }}>
          <div style={{ display: "flex", width: label, fontSize: px(17), color: INK_2, whiteSpace: "nowrap" }}>{r.label}</div>
          {r.slots.map((on, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", width: dot, height: dot, borderRadius: dot, background: on ? ACCENT : "#ffffff", border: on ? `${px(2)}px solid ${ACCENT}` : `${px(2)}px solid ${RULE_STRONG}` }} />
              {/* the bar: a hairline after the third slot */}
              <div style={{ display: "flex", width: i === 2 ? gap * 2 + 1 : gap, height: px(32), justifyContent: "center" }}>{i === 2 && <div style={{ display: "flex", width: 1, height: px(32), background: INK_3 }} />}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
  const [v2, v1] = stripBlocks();
  const res = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", fontFamily: "Newsreader", color: INK }}>
        <div style={{ display: "flex", flexDirection: "column", width: px(1200), height: px(800), padding: `${px(40)}px ${px(56)}px` }}>
          <div style={{ display: "flex", fontSize: px(28), fontWeight: 600, paddingBottom: px(12), borderBottom: `2px solid ${RULE}` }}>Crossover</div>
          <div style={{ display: "flex", marginTop: px(24), fontSize: px(38), fontWeight: 600, lineHeight: 1.15, maxWidth: px(1040) }}>{stripTitle()}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: px(36) }}>
            <Block b={v2} />
            <Block b={v1} />
          </div>
        </div>
      </div>
    ),
    { width, height, ...((f) => (f.length ? { fonts: f } : {}))(await loadFonts()) },
  );
  res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  return res;
}
