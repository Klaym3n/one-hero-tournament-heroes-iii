"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  // menu zamyka się samo po zmianie strony
  const open = openAt === pathname;
  return (
    <div className="md:hidden">
      <button
        className="btn btn-sm btn-icon"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpenAt(open ? null : pathname)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav className="leather absolute inset-x-0 top-14 border-b border-black shadow-[0_1px_0_var(--gold-dark)]" aria-label="Menu mobilne">
          <ul className="mx-auto flex max-w-6xl flex-col px-4 py-2">
            {[{ href: "/", label: "Start" }, ...items, { href: "/konto", label: "Moje konto" }].map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block border-b border-white/5 py-3 font-display font-semibold text-cream">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
