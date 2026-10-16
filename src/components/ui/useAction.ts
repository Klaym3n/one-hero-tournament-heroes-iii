"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/errors";

export type Feedback = { kind: "ok" | "error"; text: string; list?: string[] } | null;

/** Uruchamia Server Action i przechowuje komunikat zwrotny. */
export function useAction() {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function exec<T>(fn: () => Promise<ActionResult<T>>, opts: { confirm?: string; onOk?: (data: T | undefined) => void } = {}) {
    if (opts.confirm && !window.confirm(opts.confirm)) return;
    setFeedback(null);
    start(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          setFeedback(res.message ? { kind: "ok", text: res.message } : null);
          opts.onOk?.(res.data);
        } else {
          setFeedback({ kind: "error", text: res.error, list: res.errors && res.errors.length > 1 ? res.errors : undefined });
        }
      } catch {
        setFeedback({ kind: "error", text: "Błąd połączenia. Spróbuj ponownie." });
      }
    });
  }

  return { pending, feedback, setFeedback, exec };
}
