import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { SUBJECT } from "@/lib/subject";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  title: SUBJECT.appName,
  description: `Socratic ${SUBJECT.subjectName} practice drills for Philippine law students and bar reviewees`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
        <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-6">
          <header className="mb-8 flex items-baseline justify-between gap-4 border-b border-line pb-4">
            <Link href="/" className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
              {SUBJECT.appName}
            </Link>
            <nav className="flex gap-3 text-sm text-muted">
              <Link className="hover:text-accent" href="/drills">
                Drills
              </Link>
              <Link className="hover:text-accent" href="/progress">
                Progress
              </Link>
              <Link className="hover:text-accent" href="/settings">
                Settings
              </Link>
            </nav>
          </header>
          <main>{children}</main>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
