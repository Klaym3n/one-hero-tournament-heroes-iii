"use client";

import { useState } from "react";
import { acceptReportAction, disputeReportAction, setScheduleAction, setScheduleFromProposalAction } from "@/server/actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";

/** Przeciwnik: akceptacja raportu lub spór. */
export function ConfirmReport({ reportId, score }: { reportId: string; score: string }) {
  const { pending, feedback, exec } = useAction();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Przeciwnik zgłosił wynik <strong className="font-display text-gold-light">{score}</strong>. Sprawdź szczegóły raportu poniżej.
      </p>
      {!disputing ? (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-success" disabled={pending} onClick={() => exec(() => acceptReportAction(reportId))}>
            ✔ Akceptuję wynik
          </button>
          <button className="btn btn-primary" disabled={pending} onClick={() => setDisputing(true)}>
            ✖ Zgłoś spór
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="label" htmlFor="dispute-reason">
            Co się nie zgadza?
          </label>
          <textarea id="dispute-reason" className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Np. wygrałem drugą grę, przeciwnik pomylił frakcje…" maxLength={1000} />
          <p className="text-xs text-cream-dim">Możesz też złożyć własny raport – mecz trafi wtedy do moderatora z porównaniem obu wersji.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={pending} onClick={() => exec(() => disputeReportAction(reportId, reason))}>
              Wyślij zgłoszenie sporu
            </button>
            <button className="btn btn-ghost" onClick={() => setDisputing(false)}>
              Anuluj
            </button>
          </div>
        </div>
      )}
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

/** Ustalanie planowanej daty startu meczu (czas polski). */
export function ScheduleForm({ matchId, current }: { matchId: string; current: string | null }) {
  const { pending, feedback, exec } = useAction();
  const [value, setValue] = useState(current ?? "");
  return (
    <div className="space-y-2">
      <label className="label" htmlFor="sched">
        Planowany start (czas polski)
      </label>
      <div className="flex flex-wrap gap-2">
        <input id="sched" type="datetime-local" className="input max-w-60" value={value} step={900} onChange={(e) => setValue(e.target.value)} />
        <button className="btn" disabled={pending || !value} onClick={() => exec(() => setScheduleAction(matchId, value))}>
          Zapisz termin
        </button>
        {current && (
          <button className="btn btn-ghost" disabled={pending} onClick={() => exec(() => setScheduleAction(matchId, null), { confirm: "Usunąć termin meczu?", onOk: () => setValue("") })}>
            Usuń
          </button>
        )}
      </div>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

export function ProposalButton({ matchId, startsAt, label }: { matchId: string; startsAt: string; label: string }) {
  const { pending, feedback, exec } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <button
        className="btn btn-sm btn-success"
        disabled={pending}
        onClick={() => exec(() => setScheduleFromProposalAction(matchId, startsAt), { confirm: `Ustawić termin meczu: ${label}?` })}
      >
        Ustaw ten termin
      </button>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}
