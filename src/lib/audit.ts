import "server-only";
import { db, type DBOrTx } from "@/db";
import { adminAuditLog } from "@/db/schema";

export const ACTION_LABELS: Record<string, string> = {
  ADMIN_BOOTSTRAP: "Nadanie roli administratora (zmienna środowiskowa)",
  PHASE_CHANGE: "Zmiana fazy turnieju",
  GROUPS_DRAWN: "Losowanie grup",
  GROUPS_RESET: "Usunięcie grup",
  GROUP_TIEBREAK: "Ręczne rozstrzygnięcie remisu w grupie",
  BRACKET_GENERATED: "Wygenerowanie drabinki",
  ROLE_CHANGE: "Zmiana roli",
  USER_BAN: "Zbanowanie użytkownika",
  USER_UNBAN: "Odbanowanie użytkownika",
  PARTICIPANT_REMOVED: "Usunięcie z turnieju",
  PARTICIPANT_RESTORED: "Przywrócenie do turnieju",
  MATCH_EDIT: "Edycja wyniku meczu",
  MATCH_RESET: "Reset meczu",
  MATCH_WALKOVER: "Walkower",
  DISPUTE_RESOLVED: "Rozstrzygnięcie sporu",
  CONFIG_UPDATE: "Zmiana konfiguracji turnieju",
  CONTENT_UPDATE: "Zmiana treści",
  TEMPLATE_UPDATE: "Zmiana szablonów map",
  HERO_UPDATE: "Zmiana listy bohaterów",
  ANNOUNCEMENT: "Ogłoszenie",
  ROUND_PING: "Powiadomienie Discord o rundzie",
  SCHEDULE_SET: "Ustawienie terminu meczu",
};

export async function logAction(
  actorId: string | null,
  action: string,
  opts: { entityType?: string; entityId?: string; payload?: unknown } = {},
  tx: DBOrTx = db,
) {
  await tx.insert(adminAuditLog).values({
    actorId,
    action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    payload: opts.payload ?? null,
  });
}
