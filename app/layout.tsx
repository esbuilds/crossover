import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import "./globals.css";

// Display face for headings and map labels only. One weight; body text stays on the system font.
const newsreader = Newsreader({ subsets: ["latin"], weight: "600", display: "swap", variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: "Crossover",
  description: "Find a brand's best collab partners, launch cities, and pitch, backed by Qloo taste data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
