import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CSR Partnership Radar",
  description: "Weekly CSR intelligence for an education & skilling NGO — is this worth a call this week, and why?",
};

const NAV = [
  { href: "/", label: "Opportunities" },
  { href: "/digest", label: "Weekly digest" },
  { href: "/sources", label: "Sources" },
  { href: "/settings", label: "Settings" },
  { href: "/status", label: "Status" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-surface">Skip to content</a>
        <header className="border-b border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="flex items-baseline gap-2 mr-2">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-high ring-4 ring-high-bg" />
              <span className="font-serif text-xl font-semibold tracking-tight">CSR Partnership Radar</span>
            </Link>
            <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main id="main" className="flex-1">{children}</main>
        <footer className="border-t border-line text-xs text-ink-3">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-wrap gap-x-6 gap-y-1">
            <span>Scores help prioritise outreach; they do not predict funding decisions.</span>
            <span>Always confirm details on the original source before contacting a company.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
