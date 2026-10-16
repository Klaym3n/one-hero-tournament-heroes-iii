"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Odświeża dane strony, gdy serwer ogłosi zmianę w jednym z tematów (SSE /api/live).
 * Temat zakończony "*" pasuje do prefiksu, np. "match:*".
 */
export function LiveRefresh({ topics }: { topics: string[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = topics.join(",");

  useEffect(() => {
    const wanted = key.split(",");
    const es = new EventSource("/api/live");
    es.onmessage = (ev) => {
      let got: string[] = [];
      try {
        got = JSON.parse(ev.data);
      } catch {
        return;
      }
      const hit = got.some((t) => wanted.some((w) => (w.endsWith("*") ? t.startsWith(w.slice(0, -1)) : t === w)));
      if (!hit) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    return () => {
      es.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, router]);

  return null;
}
