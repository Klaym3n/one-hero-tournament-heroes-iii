"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Zgłasza każde wyświetlenie strony do /api/stats (statystyki w panelu administratora). */
export function PageViewTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // zewnętrzne źródło wejścia ma sens tylko przy pierwszym wczytaniu strony
    const ref = first.current ? document.referrer : "";
    first.current = false;
    const body = JSON.stringify({ path: pathname, ref });
    try {
      if (!navigator.sendBeacon?.("/api/stats", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/stats", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
      }
    } catch {
      // statystyki nie mogą psuć strony
    }
  }, [pathname]);

  return null;
}
