import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Syne, Caveat } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { THEME_SCRIPT } from "@/components/ui/ThemeToggle";
import { AskCipher } from "@/components/guide/AskCipher";
import { Explainer } from "@/components/guide/Explainer";
import { AmbientBackground } from "@/components/fx/AmbientBackground";
import { MobileTabBar } from "@/components/layout/MobileTabBar";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const display = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display", display: "swap" });
const hand = Caveat({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-hand", display: "swap" });

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const TITLE = "Cipher Pool: Private Prize Savings";
const DESCRIPTION =
  "A shared savings pool where the interest is given out as prizes. Nobody can see how much you saved, not even the pool. Built on Zama's encryption.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  icons: { icon: "/favicon.svg" },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Cipher Pool", type: "website", url: SITE_URL, images: [{ url: "/og.png", width: 1200, height: 630, alt: "Cipher Pool: a padlock trophy over a sphere of scrambled deposits" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} ${hand.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <AmbientBackground />
          <Header />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-8 pt-4 sm:px-6 sm:pt-6 md:pb-16 lg:px-8">{children}</main>
          <Footer />
          <MobileTabBar />
          <AskCipher />
          <Explainer />
        </Providers>
      </body>
    </html>
  );
}
