import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const display = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display", display: "swap" });

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const TITLE = "Cipher Pool — Confidential Prize Savings";
const DESCRIPTION =
  "A no-loss prize savings pool where deposits, balances and winnings stay encrypted end-to-end with the Zama Protocol. Deposit cUSD, keep your principal, win the yield.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  icons: { icon: "/favicon.svg" },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Cipher Pool", type: "website", url: SITE_URL, images: [{ url: "/og.png", width: 1200, height: 630, alt: "Cipher Pool — a padlock trophy over a sphere of encrypted deposits" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
