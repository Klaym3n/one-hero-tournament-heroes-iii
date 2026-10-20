import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { pageRequireRole, hasRole } from "@/lib/authz";
import { Loading, PageFrame } from "@/components/ui/Frame";
import { ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Panel administracyjny", robots: { index: false, follow: false } };

const LINKS: { href: string; label: string; admin?: boolean }[] = [
  { href: "/admin", label: "Pulpit" },
  { href: "/admin/turniej", label: "Turniej i fazy", admin: true },
  { href: "/admin/raporty", label: "Raporty i spory" },
  { href: "/admin/harmonogram", label: "Harmonogram" },
  { href: "/admin/uzytkownicy", label: "Użytkownicy", admin: true },
  { href: "/admin/konfiguracja", label: "Konfiguracja i treści", admin: true },
  { href: "/admin/szablony", label: "Szablony map", admin: true },
  { href: "/admin/bohaterowie", label: "Bohaterowie", admin: true },
  { href: "/admin/ogloszenia", label: "Ogłoszenia", admin: true },
  { href: "/admin/discord", label: "Discord", admin: true },
  { href: "/admin/log", label: "Log akcji" },
];

async function Sidebar() {
  await connection();
  const user = await pageRequireRole("MODERATOR");
  const isAdmin = hasRole(user, "ADMIN");
  return (
    <aside className="lg:w-56 lg:shrink-0">
      <nav className="frame-sm panel p-2" aria-label="Panel">
        <p className="px-2 pt-1 pb-2 font-display text-xs tracking-widest text-gold-light uppercase">
          Panel · {ROLE_LABELS[user.role]}
        </p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {LINKS.filter((l) => !l.admin || isAdmin).map((l) => (
            <li key={l.href} className="shrink-0">
              <Link href={l.href} className="block rounded-sm px-3 py-2 text-sm font-semibold whitespace-nowrap hover:bg-black/30 hover:text-gold-light">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

async function Guard({ children }: { children: ReactNode }) {
  await connection();
  await pageRequireRole("MODERATOR");
  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PageFrame variant="red">
      <div className="flex flex-col gap-6 lg:flex-row">
        <Suspense fallback={<div className="lg:w-56" />}>
          <Sidebar />
        </Suspense>
        <div className="min-w-0 flex-1">
          <Suspense fallback={<Loading />}>
            <Guard>{children}</Guard>
          </Suspense>
        </div>
      </div>
    </PageFrame>
  );
}
