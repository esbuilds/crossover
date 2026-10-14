import { Suspense } from "react";
import TourBar from "./tour-bar";
import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import "./globals.css";

// Display face for headings and map labels only. One weight; body text stays on the system font.
const newsreader = Newsreader({ subsets: ["latin"], weight: "600", display: "swap", variable: "--font-newsreader" });

const DESCRIPTION = "One name in: an agent measures in Qloo step by step and says who to call first, with every line checked against the step behind it.";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  title: { default: "Crossover: one name in, who should they call first?", template: "%s | Crossover" },
  description: DESCRIPTION,
  openGraph: { siteName: "Crossover", type: "website", description: DESCRIPTION, images: [{ url: "/og", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: ["/og"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <p className="px-4 py-6 text-center text-sm text-ink-3">Data: Qloo</p>
        {/* the judge tour bar reads ?tour=n; Suspense because it reads the search params */}
        <Suspense>
          <TourBar />
        </Suspense>
      </body>
    </html>
  );
}
