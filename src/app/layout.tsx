import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import Link from "next/link";
import { ThemePicker, THEME_BOOT_SCRIPT } from "@/components/ThemePicker";
import { Tour, TourButton } from "@/components/Tour";
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
  { href: "/status", label: "Status" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-surface">Skip to content</a>
        <header data-tour="header" className="border-b border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="flex items-baseline gap-2 mr-2">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent-bg" />
              <span className="font-serif text-xl font-semibold tracking-tight">CSR Partnership Radar</span>
            </Link>
            <nav aria-label="Main" data-tour="nav" className="flex flex-wrap gap-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <TourButton />
              <ThemePicker />
              <Link
                href="/settings"
                data-tour="settings"
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-bg px-3 py-1.5 text-sm font-medium text-accent hover:border-accent"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                </svg>
                Settings
              </Link>
            </div>
          </div>
        </header>
        <Tour />
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
