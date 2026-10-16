"use client";

import { useState } from "react";
import { drawGroupsAction, generateBracketAction, resetGroupsAction, setPhaseAction, setTiebreakAction } from "@/server/admin-actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";
import type { GroupVariant } from "@/lib/tournament/groups";

export function PhaseButtons({ transitions }: { transitions: { to: string; label: string; confirm: string; primary?: boolean }[] }) {
  const { pending, feedback, exec } = useAction();
  if (!transitions.length) return <p className="text-sm text-cream-dim">Brak ręcznych przejść z tej fazy.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <button key={t.to} className={`btn ${t.primary ? "btn-primary" : ""}`} disabled={pending} onClick={() => exec(() => setPhaseAction(t.to), { confirm: t.confirm })}>
            {t.label}
          </button>
        ))}
      </div>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

export function GroupDraw({ players, variants }: { players: number; variants: GroupVariant[] }) {
  const [choice, setChoice] = useState<number | null>(variants.find((v) => !v.outOfRange)?.groupCount ?? variants[0]?.groupCount ?? null);
  const { pending, feedback, exec } = useAction();
  if (players < 2) return <p className="text-sm text-cream-dim">Za mało graczy do losowania ({players}).</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Aktywnych graczy: <strong>{players}</strong>. Wybierz podział – liczba awansujących zawsze jest potęgą 2.
      </p>
      <div className="space-y-2" role="radiogroup">
        {variants.map((v) => (
          <button
            key={v.groupCount}
            type="button"
            role="radio"
            aria-checked={choice === v.groupCount}
            onClick={() => setChoice(v.groupCount)}
            className="tile flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span>
              <span className="font-display font-bold text-gold-light">{v.label}</span>
              <span className="block text-xs text-cream-dim">
                Rozmiary: {v.sizes.join(", ")} · meczów w grupach: {v.matchCount}
              </span>
            </span>
            {v.outOfRange && <span className="badge badge-red">poza zakresem 4–6</span>}
          </button>
        ))}
      </div>
      {variants.every((v) => v.outOfRange) && (
        <p className="rounded-sm border border-crimson-light/50 bg-crimson/20 px-3 py-2 text-sm">
          Dla {players} graczy nie da się utworzyć grup 4–6 osobowych z liczbą grup będącą potęgą 2. Możesz wybrać najbliższy wariant albo ponownie otworzyć zapisy, by dobrać graczy (lub usunąć nieaktywnych).
        </p>
      )}
      <button
        className="btn btn-primary"
        disabled={pending || choice === null}
        onClick={() => exec(() => drawGroupsAction(choice!), { confirm: "Rozpocząć w pełni losowe losowanie grup? Tej operacji nie da się łatwo cofnąć." })}
      >
        🎲 Losuj grupy
      </button>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

export function ResetGroups() {
  const { pending, feedback, exec } = useAction();
  return (
    <div className="space-y-2">
      <button
        className="btn btn-sm btn-ghost"
        disabled={pending}
        onClick={() => exec(resetGroupsAction, { confirm: "UWAGA: usunie wszystkie grupy i mecze grupowe (łącznie z wynikami) i wróci do fazy 'Zapisy zamknięte'. Kontynuować?" })}
      >
        Usuń grupy i losuj ponownie
      </button>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

export function BracketGenerate({ ready, incomplete }: { ready: boolean; incomplete: number }) {
  const [force, setForce] = useState(false);
  const { pending, feedback, exec } = useAction();
  return (
    <div className="space-y-3">
      {!ready && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="accent-[var(--gold)]" />
          Wymuś mimo {incomplete} niezakończonych meczów grupowych (zostaną anulowane)
        </label>
      )}
      <button
        className="btn btn-primary"
        disabled={pending || (!ready && !force)}
        onClick={() => exec(() => generateBracketAction(force), { confirm: "Wygenerować drabinkę pucharową na podstawie tabel grup?" })}
      >
        Generuj drabinkę
      </button>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

export function Tiebreak({ groupId, groupName, players }: { groupId: string; groupName: string; players: { id: string; nick: string }[] }) {
  const [order, setOrder] = useState(players);
  const { pending, feedback, exec } = useAction();
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setOrder(next);
  };
  return (
    <div className="space-y-2 rounded-sm border border-crimson/40 bg-crimson/10 p-3">
      <p className="text-sm font-semibold">Grupa {groupName}: ustal kolejność ręcznie (remis)</p>
      <ol className="space-y-1">
        {order.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-right text-cream-dim">{i + 1}.</span>
            <span className="flex-1">{p.nick}</span>
            <button className="btn btn-sm btn-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="W górę">
              ↑
            </button>
            <button className="btn btn-sm btn-icon" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="W dół">
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button className="btn btn-sm" disabled={pending} onClick={() => exec(() => setTiebreakAction(groupId, order.map((o) => o.id)))}>
        Zapisz kolejność
      </button>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}
