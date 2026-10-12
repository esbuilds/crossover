// Layout for the constellation, shared by the page (app/map/constellation-view.tsx) and its share card. Pure.
import type { Constellation } from "./constellation.ts";

export const FONT = 14;

export type Placed = { i: number; cx: number; cy: number; r: number; label: { x: number; y: number; anchor: "start" | "end" | "middle" } | null };

// Fit the projection into the box at one scale for both axes (distances keep their meaning), then place labels:
// right, left, above, below, first that overlaps nothing; a label with no room folds to a number with a key.
// ponytail: greedy placement in popularity order; fine for 12 dots, use a force layout if categories grow.
export function place(c: Constellation, W: number, H: number, pad: number, font = FONT): Placed[] {
  // on a tall box (phones) the projection's long axis runs down the screen: same distances, turned 90 degrees
  const turn = H > W;
  const xs = c.dots.map((d) => (turn ? d.y : d.x)), ys = c.dots.map((d) => (turn ? d.x : d.y));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
  const pts = c.dots.map((_, i) => ({ i, cx: ox + (xs[i] - x0) * k, cy: oy + (ys[i] - y0) * k, r: 6 + 10 * (c.dots[i].popularity ?? 0) }));
  type Box = [number, number, number, number];
  const boxes: Box[] = pts.map((p) => [p.cx - p.r, p.cy - p.r, p.cx + p.r, p.cy + p.r]);
  const hit = (b: Box) => b[0] < 0 || b[2] > W || b[1] < 0 || b[3] > H || boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const order = [...pts].sort((a, b) => (c.dots[b.i].popularity ?? 0) - (c.dots[a.i].popularity ?? 0));
  const out = new Map<number, Placed>();
  for (const p of order) {
    const w = c.dots[p.i].name.length * font * 0.56, g = 4;
    const tries: [Box, Placed["label"]][] = [
      [[p.cx + p.r + g, p.cy - font / 2, p.cx + p.r + g + w, p.cy + font / 2], { x: p.cx + p.r + g, y: p.cy + font * 0.35, anchor: "start" }],
      [[p.cx - p.r - g - w, p.cy - font / 2, p.cx - p.r - g, p.cy + font / 2], { x: p.cx - p.r - g, y: p.cy + font * 0.35, anchor: "end" }],
      [[p.cx - w / 2, p.cy - p.r - g - font, p.cx + w / 2, p.cy - p.r - g], { x: p.cx, y: p.cy - p.r - g - 2, anchor: "middle" }],
      [[p.cx - w / 2, p.cy + p.r + g, p.cx + w / 2, p.cy + p.r + g + font], { x: p.cx, y: p.cy + p.r + g + font - 2, anchor: "middle" }],
    ];
    const ok = tries.find(([b]) => !hit(b));
    if (ok) boxes.push(ok[0]);
    out.set(p.i, { ...p, label: ok ? ok[1] : null });
  }
  return pts.map((p) => out.get(p.i)!);
}

// The lines: each brand to its nearest audience, plus every pair at 0.95 or more. Thicker and darker is closer.
export const STRONG = 0.95;
export function edges(c: Constellation): [number, number, number][] {
  const out = new Map<string, [number, number, number]>();
  c.affinity.forEach((row, i) => {
    let best = -1;
    row.forEach((v, j) => {
      if (v === null) return;
      if (best < 0 || v > (row[best] ?? -1)) best = j;
      if (v >= STRONG) out.set(`${Math.min(i, j)}-${Math.max(i, j)}`, [Math.min(i, j), Math.max(i, j), v]);
    });
    if (best >= 0) out.set(`${Math.min(i, best)}-${Math.max(i, best)}`, [Math.min(i, best), Math.max(i, best), row[best]!]);
  });
  return [...out.values()];
}


// The share card: dots and the 0.95+ lines as an SVG string at the card's image size, plus every name the layout has room for
// as positioned labels (the card draws text itself). Same layout as the page.
export function constellationCard(c: Constellation, W = 688, H = 430) {
  const font = 20;
  const placed = place(c, W, H, 34, font);
  const ink = "#58514d";
  const lines = edges(c)
    .filter(([, , v]) => v >= STRONG)
    .map(([i, j, v]) => `<line x1="${placed[i].cx.toFixed(1)}" y1="${placed[i].cy.toFixed(1)}" x2="${placed[j].cx.toFixed(1)}" y2="${placed[j].cy.toFixed(1)}" stroke="${ink}" stroke-opacity="${(0.3 + 0.5 * Math.min(1, (v - 0.95) / 0.03)).toFixed(2)}" stroke-width="3"/>`)
    .join("");
  const dots = placed.map((p) => `<circle cx="${p.cx.toFixed(1)}" cy="${p.cy.toFixed(1)}" r="${p.r.toFixed(1)}" fill="${ink}" fill-opacity="0.8"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="12" fill="#f8f7f6"/>${lines}${dots}</svg>`;
  const labels = placed
    .filter((p) => p.label)
    .map((p) => {
      const text = c.dots[p.i].name, w = text.length * font * 0.5, l = p.label!;
      return { x: Math.round(l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2), y: Math.round(l.y - font * 0.35 + 4), text };
    });
  return { svg, labels };
}
