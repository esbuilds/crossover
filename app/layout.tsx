import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import "./globals.css";

// Display face for headings and map labels only. One weight; body text stays on the system font.
const newsreader = Newsreader({ subsets: ["latin"], weight: "600", display: "swap", variable: "--font-newsreader" });

const DESCRIPTION = "Two names in: one US map of where each audience over-indexes and which brands sit closer to each side, from Qloo affinity and heatmaps.";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  title: { default: "Crossover: two names in, see where their audiences split", template: "%s | Crossover" },
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
      </body>
    </html>
  );
}
