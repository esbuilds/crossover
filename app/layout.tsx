import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crossover",
  description: "Find a brand's best collab partners, launch cities, and pitch, backed by Qloo taste data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
