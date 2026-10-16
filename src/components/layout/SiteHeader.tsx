import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";

export const NAV = [
  { href: "/turniej", label: "Turniej" },
  { href: "/grupy", label: "Grupy" },
  { href: "/drabinka", label: "Drabinka" },
  { href: "/gracze", label: "Gracze" },
  { href: "/regulamin", label: "Regulamin" },
];

/** Górny pasek w stylu paska zasobów z ekranu przygody. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black bg-[linear-gradient(180deg,#2c2214_0%,#1a130a_100%)] shadow-[0_1px_0_var(--gold-dark),0_2px_0_#000,0_6px_18px_rgba(0,0,0,0.5)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Strona główna">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={28} height={31} />
          <span className="title-gold text-lg font-black leading-none sm:text-xl">One Hero</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Główna nawigacja">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-sm px-3 py-1.5 font-display text-sm font-semibold text-cream hover:bg-white/5 hover:text-gold-light"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<span className="h-8 w-24 animate-pulse rounded-sm bg-white/5" />}>
            <UserMenu />
          </Suspense>
          <Suspense fallback={null}>
            <MobileNav items={NAV} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
