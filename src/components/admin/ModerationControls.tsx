"use client";

import { useState } from "react";
import { staffAcceptReportAction, staffResetMatchAction, staffScheduleAction, staffSetResultAction, staffWalkoverAction } from "@/server/admin-actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";
import { ReportForm, type HeroOption } from "@/components/report/ReportForm";

function ForceToggle({ force, setForce }: { force: boolean; setForce: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-cream-dim">
      <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="accent-[var(--gold)]" />
      Wymuś (cofnij zależne mecze w drabince, jeśli zostały już rozpoczęte)
    </label>
  );
}

export function AcceptReport({ reportId, label }: { reportId: string; label: string }) {
  const [resolution, setResolution] = useState("");
  const [force, setForce] = useState(false);
  const { pending, feedback, exec } = useAction();
  return (
    <div className="space-y-2 rounded-sm bg-black/20 p-3">
      <input className="input py-1.5 text-sm" placeholder="Uzasadnienie decyzji (widoczne dla graczy)" value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={500} />
      <ForceToggle force={force} setForce={setForce} />
      <button className="btn btn-sm btn-success" disabled={pending} onClick={() => exec(() => staffAcceptReportAction(reportId, resolution, force), { confirm: `Zatwierdzić ten raport (${label}) jako obowiązujący?` })}>
        ✔ Zatwierdź ten raport
      </button>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

export function StaffResultEditor(props: { matchId: string; bestOf: number; nickA: string; nickB: string; templates: { id: string; name: string }[]; heroes: HeroOption[]; assets: { factions: string[]; heroes: string[] } }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);
  if (!open)
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        ✎ Wprowadź / skoryguj wynik
      </button>
    );
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="staff-reason">
          Powód korekty (wymagany, trafia do historii)
        </label>
        <input id="staff-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </div>
      <ForceToggle force={force} setForce={setForce} />
      <ReportForm
        {...props}
        mySide={null}
        submitLabel="Zapisz wynik jako moderator"
        onSubmitOverride={(payload) => staffSetResultAction(props.matchId, payload, reason, force)}
      />
    </div>
  );
}

export function WalkoverReset({ matchId, nickA, nickB, canReset }: { matchId: string; nickA: string; nickB: string; canReset: boolean }) {
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);
  const { pending, feedback, exec } = useAction();
  return (
    <div className="space-y-3">
      <input className="input" placeholder="Powód (wymagany)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      <ForceToggle force={force} setForce={setForce} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm" disabled={pending} onClick={() => exec(() => staffWalkoverAction(matchId, "A", reason, force), { confirm: `Walkower dla ${nickA}?` })}>
          Walkower: {nickA}
        </button>
        <button className="btn btn-sm" disabled={pending} onClick={() => exec(() => staffWalkoverAction(matchId, "B", reason, force), { confirm: `Walkower dla ${nickB}?` })}>
          Walkower: {nickB}
        </button>
        {canReset && (
          <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => exec(() => staffResetMatchAction(matchId, reason, force), { confirm: "Zresetować mecz do stanu 'do rozegrania'? Raporty zostaną oznaczone jako zastąpione." })}>
            Resetuj mecz
          </button>
        )}
      </div>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

export function StaffSchedule({ matchId, current }: { matchId: string; current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const { pending, feedback, exec } = useAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input type="datetime-local" className="input max-w-60" value={value} step={900} onChange={(e) => setValue(e.target.value)} />
        <button className="btn btn-sm" disabled={pending} onClick={() => exec(() => staffScheduleAction(matchId, value || null))}>
          Zapisz termin
        </button>
      </div>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}
