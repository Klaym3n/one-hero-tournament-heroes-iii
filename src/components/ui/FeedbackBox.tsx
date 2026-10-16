"use client";

import type { Feedback } from "./useAction";

export function FeedbackBox({ feedback, className = "" }: { feedback: Feedback; className?: string }) {
  if (!feedback) return null;
  const ok = feedback.kind === "ok";
  return (
    <div
      role={ok ? "status" : "alert"}
      className={`rounded-sm border px-3 py-2 text-sm ${ok ? "border-emerald-light/50 bg-emerald/20 text-[#c9f5da]" : "border-crimson-light/60 bg-crimson/25 text-[#ffd0d4]"} ${className}`}
    >
      <p>{feedback.text}</p>
      {feedback.list && (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {feedback.list.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
