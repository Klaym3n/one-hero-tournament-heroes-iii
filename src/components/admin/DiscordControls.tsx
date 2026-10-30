"use client";

import { useState } from "react";
import { pingRoundAction, previewRoundPingAction, retryOutboxAction } from "@/server/admin-actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";
import { DiscordIcon } from "@/components/ui/icons";

type Preview = { label: string; preview: string; matches: number; parts: number };

/** Linia wiadomości z oznaczeniami @nick i pogrubieniem **…** jak w Discordzie. */
function DiscordLine({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|@[^\s]+)/g).map((chunk, i) =>
        chunk.startsWith("**") && chunk.endsWith("**") ? (
          <strong key={i}>{chunk.slice(2, -2)}</strong>
        ) : chunk.startsWith("@") ? (
          <span key={i} className="rounded-sm bg-[#5865f2]/30 px-0.5 text-[#c9cdfb]">
            {chunk}
          </span>
        ) : (
          chunk
        ),
      )}
    </>
  );
}

export function PingRound({ defaultLabel, openMatches, disabled }: { defaultLabel: string; openMatches: number; disabled: boolean }) {
  const [label, setLabel] = useState(defaultLabel);
  const [preview, setPreview] = useState<Preview | null>(null);
  const { pending, feedback, exec } = useAction();
  // wysyłka tylko po obejrzeniu podglądu dla aktualnej nazwy rundy
  const fresh = preview?.label === label;
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="round-label">
          Nazwa rundy w wiadomości
        </label>
        <input id="round-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn"
          disabled={pending || openMatches === 0}
          onClick={() => exec(() => previewRoundPingAction(label), { onOk: (d) => d && setPreview({ ...d, label }) })}
        >
          Podgląd wiadomości
        </button>
        <button
          className="btn btn-primary"
          disabled={pending || disabled || openMatches === 0 || !fresh}
          title={fresh ? undefined : "Najpierw obejrzyj podgląd wiadomości"}
          onClick={() =>
            exec(() => pingRoundAction(label), {
              confirm: `Wysłać na kanał Discord wiadomość z oznaczeniem graczy z ${preview!.matches} otwartych meczów?`,
              onOk: () => setPreview(null),
            })
          }
        >
          <DiscordIcon /> Wyślij na Discord ({openMatches} meczów)
        </button>
      </div>
      {preview && (
        <div className={fresh ? "" : "opacity-50"}>
          <p className="label">
            Podgląd {fresh ? "" : "(nieaktualny – nazwa rundy się zmieniła)"}
            {preview.parts > 1 && ` · zostanie wysłana w ${preview.parts} częściach (limit Discorda)`}
          </p>
          <div className="max-h-96 overflow-y-auto rounded-sm border border-black/60 bg-[#313338] p-3 text-sm leading-relaxed whitespace-pre-wrap text-[#dbdee1]">
            {preview.preview.split("\n").map((line, i) => (
              <div key={i} className="min-h-[1.2em] break-words">
                <DiscordLine text={line} />
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-cream-dim">Oznaczenia @nick zostaną wysłane jako wzmianki Discord (powiadomią graczy).</p>
        </div>
      )}
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
