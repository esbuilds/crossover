import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import "./globals.css";

// Display face for headings and map labels only. One weight; body text stays on the system font.
const newsreader = Newsreader({ subsets: ["latin"], weight: "600", display: "swap", variable: "--font-newsreader" });

const DESCRIPTION = "Find the brands, artists, shows and places a brand's fans already love, the US markets to launch in, and a brief, from Qloo taste data.";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  title: { default: "Crossover: who should you collab with, and where?", template: "%s | Crossover" },
  description: DESCRIPTION,
  openGraph: { siteName: "Crossover", type: "website", description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <p className="px-4 py-6 text-center text-sm text-ink-3">Data: Qloo</p>
      </body>
    </html>
  );
}
