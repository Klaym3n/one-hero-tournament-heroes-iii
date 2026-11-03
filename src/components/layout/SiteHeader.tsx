import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { getSessionUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/authz";

export const NAV = [
  { href: "/turniej", label: "Turniej" },
  { href: "/grupy", label: "Grupy" },
  { href: "/drabinka", label: "Drabinka" },
  { href: "/gracze", label: "Gracze" },
  { href: "/regulamin", label: "Regulamin" },
];

/** Menu mobilne – moderatorzy dostają w nim link do panelu (przycisk „Panel” jest ukryty na telefonie). */
async function MobileMenu() {
  const user = await getSessionUser();
  return <MobileNav items={NAV} panel={hasRole(user, "MODERATOR")} />;
}

/** Górny pasek w stylu paska zasobów z ekranu przygody. */
export function SiteHeader() {
  return (
    <header className="leather sticky top-0 z-40 border-b border-black shadow-[0_1px_0_var(--gold-dark),0_2px_0_#000,0_6px_18px_rgba(0,0,0,0.5)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-1" aria-label="One Hero Open – strona główna">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/oho-ikona.png" alt="" width={44} height={44} className="-my-1 h-11 w-11" />
          <span className="title-gold text-lg leading-none font-black sm:text-xl">
            <span className="lg:hidden">OHO</span>
            <span className="hidden lg:inline">One Hero Open</span>
          </span>
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
          <Suspense fallback={<MobileNav items={NAV} />}>
            <MobileMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
