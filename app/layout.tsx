import Link from "next/link";
import { Suspense } from "react";
import TourBar from "./tour-bar";
import { JudgePath, linkInline } from "./ui";
import { tourHref } from "@/lib/tour.ts";
import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
import "./globals.css";

// Display face for headings and map labels only; body text stays on the system font. One static weight: the variable
// cut with optical size (TR F4) measured 129 KB preloaded against 24 KB, for a difference barely visible at 36 px
// (real Oct 20). The italic is its own small file, not preloaded, and only the "vs" on /vs uses it.
const newsreader = Newsreader({ subsets: ["latin"], weight: "600", display: "swap", variable: "--font-newsreader" });
const newsreaderItalic = Newsreader({ subsets: ["latin"], weight: "600", style: "italic", display: "swap", preload: false, variable: "--font-newsreader-italic" });

const DESCRIPTION = "One name in: an agent measures in Qloo step by step and says who to call first, with every line checked against the step behind it.";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  title: { default: "Crossover: one name in, who should they call first?", template: "%s | Crossover" },
  description: DESCRIPTION,
  openGraph: { siteName: "Crossover", type: "website", description: DESCRIPTION, images: [{ url: "/og", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: ["/og"] },
};

// icon.svg and apple-icon.png beside this file are the tab and home-screen icon (TR F1)
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${newsreaderItalic.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* JS off (judge round, real Oct 25): cacheComponents streams every request-time read as a hidden segment a
            script swaps in. Without scripts, show the page segments (the ones holding a .pt-page section; the nav's
            fallback is already the same links) where the marked fallbacks were, in the shell's width, and keep the
            footer last. The reveal sits in Tailwind's base layer, beside its !important [hidden] rule, so it can win.
            Nothing here applies with JS on. */}
        <noscript><style>{`body{display:flex;flex-direction:column}body>footer{order:1}[data-fallback]{display:none}@layer base{div[hidden][id^="S:"]:has(>.pt-page){display:block!important;width:100%;max-width:var(--container-shell);margin-inline:auto;padding-inline:var(--spacing-gutter)}}`}</style></noscript>
        {children}
        {/* one colophon on every page (DC F6, TR F10): it carries the three stops and the tour */}
        <footer className="mx-auto max-w-shell px-gutter pb-12 text-sm text-ink-3 print:hidden">
          <div className="border-t border-rule pt-8">
            <p><span className="font-display text-base text-ink">Crossover</span> · Data: Qloo, built on its taste graph</p>
            <JudgePath />
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <Link href={tourHref(1)} className={linkInline}>Take the 60-second tour</Link>
              <Link href="/replay" className={linkInline}>Real deals</Link>
              <Link href="/pick-three" className={linkInline}>Pick three</Link>
              <Link href="/audit#api-notes" className={linkInline}>Notes on the API</Link>
            </p>
          </div>
        </footer>
        {/* the judge tour bar reads ?tour=n; Suspense because it reads the search params */}
        <Suspense>
          <TourBar />
        </Suspense>
      </body>
    </html>
  );
}
