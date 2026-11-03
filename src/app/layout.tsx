import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { connection } from "next/server";
import { Suspense } from "react";
import { env } from "@/lib/env";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Loading } from "@/components/ui/Frame";
import { PageViewTracker } from "@/components/PageViewTracker";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin", "latin-ext"], weight: ["600", "700", "900"], display: "swap" });

// APP_URL jest znany dopiero przy starcie kontenera (obraz budowany w CI), więc czytamy go w czasie żądania –
// inaczej og:image / twitter:image wskazywałyby na localhost.
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return {
    metadataBase: new URL(env().APP_URL),
    title: { default: "One Hero Open – Heroes III", template: "%s · One Hero Open" },
    description: "One Hero Open (OHO) – turniej One Hero w Heroes of Might and Magic III organizowany przez Turnieje Orzecha.",
    applicationName: "One Hero Open",
    openGraph: { siteName: "One Hero Open", locale: "pl_PL", type: "website" },
  };
}

export const viewport: Viewport = { themeColor: "#16171b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className={`${inter.variable} ${cinzel.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </main>
        <SiteFooter />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
      </body>
    </html>
  );
}
