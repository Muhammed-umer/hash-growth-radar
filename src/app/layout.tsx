import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ShieldCheck } from "lucide-react";
import "./globals.css";
import { Nav } from "@/components/nav";
import { ScoreHelp } from "@/components/score-help";
import { Toaster } from "@/components/toast";
import { RETENTION_DAYS } from "@/lib/config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  // Browser tab: the page name alone. "Growth Radar" shows only where a page sets no title.
  title: { default: "Growth Radar", template: "%s" },
  description: "Find the people who need Hash today, and show them to you. You decide whom to approach.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Nav />
        {/* On large screens the nav is a 15rem column on the left; the content sits beside it. */}
        <div className="flex flex-1 flex-col lg:pl-60">
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
          <footer className="border-t border-stone-200/80">
            <div className="mx-auto flex max-w-5xl items-start gap-2 px-4 pb-20 pt-5 text-xs text-stone-600 sm:px-6 sm:pb-5 lg:px-8">
              <ShieldCheck className="mt-px size-4 shrink-0 text-emerald-700" aria-hidden />
              <p>
                Internal tool for the Hash Health team. We tag the question, never the person. Stored comments are deleted {RETENTION_DAYS} days after YouTube last returned them.
              </p>
            </div>
          </footer>
        </div>
        <ScoreHelp />
        <Toaster />
      </body>
    </html>
  );
}
