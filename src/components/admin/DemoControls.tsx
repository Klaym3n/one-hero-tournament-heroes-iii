"use client";

import { useState } from "react";
import { clearDemoAction, seedDemoAction } from "@/server/admin-actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";

/** Wczytywanie i usuwanie danych demonstracyjnych (widoczne tylko przy ALLOW_DEMO_DATA=true). */
export function DemoControls({ phase, max }: { phase: string; max: number }) {
  const [players, setPlayers] = useState(40);
  const [bracket, setBracket] = useState(true);
  const seed = useAction();
  const clear = useAction();
  const [summary, setSummary] = useState<string | null>(null);
  const canSeed = phase === "DRAFT" || phase === "REGISTRATION_OPEN";

  return (
    <div className="space-y-5">
      <p className="text-sm text-cream-dim">
        Środowisko testowe: tworzy graczy demo (konta „demo0”, „demo1”… bez Discorda), losuje grupy i rozgrywa część meczów. Na konta demo nie da się
        zalogować – służą do pokazania grup, wyników i drabinki.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="label" htmlFor="demo-players">
            Liczba graczy demo
          </label>
          <input
            id="demo-players"
            className="input max-w-28"
            type="number"
            min={4}
            max={max}
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={bracket} onChange={(e) => setBracket(e.target.checked)} />
          Rozegraj całą fazę grupową i wygeneruj drabinkę
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={seed.pending || !canSeed}
          onClick={() =>
            seed.exec(() => seedDemoAction(players, bracket), {
              confirm: `Wczytać ${players} graczy demo? Zapisy zostaną zamknięte, a grupy wylosowane.`,
              onOk: (s) => setSummary(s ?? null),
            })
          }
        >
          {seed.pending ? "Wczytywanie… (to może potrwać kilkadziesiąt sekund)" : "Wczytaj dane demo"}
        </button>
      </div>
      {!canSeed && <p className="text-xs text-cream-dim">Dane demo można wczytać w fazie przygotowań lub otwartych zapisów – najpierw usuń obecne dane.</p>}
      <FeedbackBox feedback={seed.feedback} />
      {summary && <p className="text-sm">{summary}</p>}

      <div className="border-t border-gold-dark/40 pt-4">
        <p className="mb-3 text-sm text-cream-dim">
          Usuwa <strong className="text-cream">wszystkie mecze i grupy</strong> turnieju (także prawdziwych graczy), konta demo i ogłoszenie demo. Zapisani
          prawdziwi gracze, treści i konfiguracja zostają, a turniej wraca do fazy otwartych zapisów.
        </p>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={clear.pending}
          onClick={() =>
            clear.exec(() => clearDemoAction(), {
              confirm: "Usunąć dane demo oraz WSZYSTKIE mecze i grupy turnieju? Tej operacji nie można cofnąć.",
              onOk: () => setSummary(null),
            })
          }
        >
          {clear.pending ? "Usuwanie…" : "Usuń dane demo"}
        </button>
        <div className="mt-2">
          <FeedbackBox feedback={clear.feedback} />
        </div>
      </div>
    </div>
  );
}
