"use client";

import { banAction, removeParticipantAction, restoreParticipantAction, setRoleAction } from "@/server/admin-actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";

export function UserRowControls({
  userId,
  role,
  banned,
  participantId,
  participantStatus,
  isSelf,
}: {
  userId: string;
  role: string;
  banned: boolean;
  participantId: string | null;
  participantStatus: string | null;
  isSelf: boolean;
}) {
  const { pending, feedback, exec } = useAction();
  const ask = (q: string) => {
    const r = window.prompt(q);
    return r === null ? null : r.trim();
  };
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="select w-auto py-1 text-xs"
          value={role}
          disabled={pending}
          aria-label="Rola"
          onChange={(e) => {
            const next = e.target.value;
            exec(() => setRoleAction(userId, next), { confirm: `Zmienić rolę na: ${e.target.selectedOptions[0].text}?` });
          }}
        >
          <option value="PLAYER">Gracz</option>
          <option value="MODERATOR">Moderator</option>
          <option value="ADMIN">Administrator</option>
        </select>
        {participantId && participantStatus === "ACTIVE" && (
          <button
            className="btn btn-sm btn-ghost"
            disabled={pending}
            onClick={() => {
              const r = ask("Powód usunięcia z turnieju (nierozegrane mecze zakończą się walkowerem):");
              if (r !== null) exec(() => removeParticipantAction(participantId, r));
            }}
          >
            Usuń z turnieju
          </button>
        )}
        {participantId && participantStatus === "WITHDRAWN" && (
          <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => exec(() => restoreParticipantAction(participantId), { confirm: "Przywrócić gracza do turnieju?" })}>
            Przywróć
          </button>
        )}
        {!isSelf &&
          (banned ? (
            <button className="btn btn-sm" disabled={pending} onClick={() => exec(() => banAction(userId, false, ""), { confirm: "Zdjąć ban?" })}>
              Odbanuj
            </button>
          ) : (
            <button
              className="btn btn-sm btn-primary"
              disabled={pending}
              onClick={() => {
                const r = ask("Powód bana (konto zostanie wylogowane i usunięte z turnieju):");
                if (r !== null) exec(() => banAction(userId, true, r));
              }}
            >
              Banuj
            </button>
          ))}
      </div>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}
