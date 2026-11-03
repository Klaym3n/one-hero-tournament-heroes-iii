"use client";

import { useEffect, useRef } from "react";

/** Siatka grup: rozwinięcie „Mecze grupy” rozwija też grupy w tym samym rzędzie, żeby obok nie zostawała pusta przestrzeń. */
export function GroupGrid({ children }: { children: React.ReactNode }) {
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    // zdarzenie toggle nie bąbelkuje – nasłuch w fazie przechwytywania
    const onToggle = (e: Event) => {
      const source = e.target as HTMLDetailsElement;
      const top = source.closest("section")?.offsetTop;
      for (const d of el.querySelectorAll<HTMLDetailsElement>("details")) {
        if (d.closest("section")?.offsetTop === top && d.open !== source.open) d.open = source.open;
      }
    };
    el.addEventListener("toggle", onToggle, true);
    return () => el.removeEventListener("toggle", onToggle, true);
  }, []);

  return (
    <div ref={grid} className="grid gap-8 max-sm:grid-cols-1 md:grid-cols-2">
      {children}
    </div>
  );
}
