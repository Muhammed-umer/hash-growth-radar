import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Hash Growth Radar",
  description: "Find the people who need Hash today, and show them to you. You decide whom to approach.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="px-6 py-4 text-center text-xs text-stone-500">
          Internal tool for the Hash Health team. We tag the question, never the person. Items are deleted after 7 days.
        </footer>
      </body>
    </html>
  );
}
