import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Loading } from "@/components/ui/Frame";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin", "latin-ext"], weight: ["600", "700", "900"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Turniej One Hero – Heroes III", template: "%s · Turniej One Hero" },
  description: "Turniej 1v1 w Heroes of Might and Magic III: zapisy, grupy, drabinka i wyniki na żywo.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#12101c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className={`${inter.variable} ${cinzel.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
