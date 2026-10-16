"use client";

import type { ReactNode } from "react";
import type { ActionResult } from "@/server/errors";
import { useAction } from "./useAction";
import { FeedbackBox } from "./FeedbackBox";

type Props = {
  action: () => Promise<ActionResult<unknown>>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  disabled?: boolean;
};

/** Przycisk wywołujący Server Action z potwierdzeniem i komunikatem zwrotnym. */
export function ActionButton({ action, children, className = "btn", confirm, disabled }: Props) {
  const { pending, feedback, exec } = useAction();
  return (
    <span className="inline-flex flex-col gap-2">
      <button type="button" className={className} disabled={pending || disabled} onClick={() => exec(action, { confirm })}>
        {pending ? "…" : children}
      </button>
      <FeedbackBox feedback={feedback} />
    </span>
  );
}
