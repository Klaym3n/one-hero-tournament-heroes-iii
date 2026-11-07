"use client";

import { useState } from "react";
import { acceptReportAction, disputeReportAction, setScheduleAction, setScheduleFromProposalAction } from "@/server/actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";

/** Przeciwnik: akceptacja raportu lub spór. */
/** `children` – podgląd raportu przeciwnika (frakcje, bohaterowie, kolory, dni) pokazywany przed decyzją. */
export function ConfirmReport({ reportId, score, children }: { reportId: string; score: string; children?: React.ReactNode }) {
  const { pending, feedback, exec } = useAction();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Przeciwnik zgłosił wynik <strong className="font-display text-gold-light">{score}</strong>. Sprawdź szczegóły raportu przed akceptacją.
      </p>
      {children}
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

/** "2026-11-07T18:15" → "07.11.2026, 18:15" */
function fmtLocal(v: string) {
  const [d, time] = v.split("T");
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}, ${time?.slice(0, 5)}`;
}

/** Drugi krok zapisu terminu: gracz potwierdza, że termin pasuje obu stronom. */
function ConfirmSchedule({ label, pending, onConfirm, onCancel }: { label: string; pending: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="frame-xs space-y-3 bg-black/30 p-3" role="alertdialog" aria-labelledby="confirm-schedule">
      <p id="confirm-schedule" className="text-sm">
        Termin meczu <strong className="font-display text-gold-light">{label}</strong> (czas polski) zostanie zapisany i będzie widoczny publicznie. Czy potwierdzasz, że
        ten termin na pewno odpowiada <strong>obydwu zawodnikom</strong>?
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm btn-success" disabled={pending} onClick={onConfirm}>
          ✔ Tak, termin pasuje obu – zapisz
        </button>
        <button className="btn btn-sm btn-ghost" disabled={pending} onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

/** Ustalanie planowanej daty startu meczu (czas polski). */
export function ScheduleForm({ matchId, current }: { matchId: string; current: string | null }) {
  const { pending, feedback, exec } = useAction();
  const [value, setValue] = useState(current ?? "");
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-2">
      <label className="label" htmlFor="sched">
        Planowany start (czas polski)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="sched"
          type="datetime-local"
          className="input max-w-60"
          value={value}
          step={900}
          onChange={(e) => {
            setValue(e.target.value);
            setConfirming(false);
          }}
        />
        <button className="btn" disabled={pending || !value || value === current || confirming} onClick={() => setConfirming(true)}>
          Zapisz termin
        </button>
        {current && (
          <button className="btn btn-ghost" disabled={pending} onClick={() => exec(() => setScheduleAction(matchId, null), { confirm: "Usunąć termin meczu?", onOk: () => setValue("") })}>
            Usuń
          </button>
        )}
      </div>
      {confirming && value && (
        <ConfirmSchedule
          label={fmtLocal(value)}
          pending={pending}
          onConfirm={() => exec(() => setScheduleAction(matchId, value), { onOk: () => setConfirming(false) })}
          onCancel={() => setConfirming(false)}
        />
      )}
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

export function ProposalButton({ matchId, startsAt, label }: { matchId: string; startsAt: string; label: string }) {
  const { pending, feedback, exec } = useAction();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      {confirming ? (
        <ConfirmSchedule
          label={label}
          pending={pending}
          onConfirm={() => exec(() => setScheduleFromProposalAction(matchId, startsAt), { onOk: () => setConfirming(false) })}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <button className="btn btn-sm btn-success" disabled={pending} onClick={() => setConfirming(true)}>
          Ustaw ten termin
        </button>
      )}
      <FeedbackBox feedback={feedback} />
    </div>
  );
}
