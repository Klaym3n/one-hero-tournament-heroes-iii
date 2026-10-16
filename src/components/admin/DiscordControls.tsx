"use client";

import { useState } from "react";
import { pingRoundAction, retryOutboxAction } from "@/server/admin-actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";
import { DiscordIcon } from "@/components/ui/icons";

export function PingRound({ defaultLabel, openMatches, disabled }: { defaultLabel: string; openMatches: number; disabled: boolean }) {
  const [label, setLabel] = useState(defaultLabel);
  const { pending, feedback, exec } = useAction();
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="round-label">
          Nazwa rundy w wiadomości
        </label>
        <input id="round-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} />
      </div>
      <button
        className="btn btn-primary"
        disabled={pending || disabled || openMatches === 0}
        onClick={() => exec(() => pingRoundAction(label), { confirm: `Wysłać na kanał Discord wiadomość z oznaczeniem graczy z ${openMatches} otwartych meczów?` })}
      >
        <DiscordIcon /> Ogłoś rundę ({openMatches} meczów)
      </button>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

export function RetryButton({ id }: { id: string }) {
  const { pending, feedback, exec } = useAction();
  return (
    <span className="inline-flex flex-col">
      <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => exec(() => retryOutboxAction(id))}>
        Ponów
      </button>
      <FeedbackBox feedback={feedback} />
    </span>
  );
}
