import type { Match, Phase, Role } from "@/db/schema";

export const PHASE_LABELS: Record<Phase, string> = {
  DRAFT: "Przygotowania",
  REGISTRATION_OPEN: "Zapisy otwarte",
  REGISTRATION_CLOSED: "Zapisy zamknięte",
  GROUPS: "Faza grupowa",
  KNOCKOUT: "Faza pucharowa",
  FINISHED: "Zakończony",
};

export const ROLE_LABELS: Record<Role, string> = {
  PLAYER: "Gracz",
  MODERATOR: "Moderator",
  ADMIN: "Administrator",
};

export const MATCH_STATUS_LABELS: Record<Match["status"], string> = {
  WAITING: "Oczekuje na rywala",
  PENDING: "Do rozegrania",
  REPORTED: "Czeka na potwierdzenie",
  DISPUTED: "Spór",
  CONFIRMED: "Zatwierdzony",
  WALKOVER: "Walkower",
};

export const STAGE_LABELS: Record<Match["stage"], string> = {
  GROUP: "Faza grupowa",
  KNOCKOUT: "Faza pucharowa",
  THIRD_PLACE: "Mecz o 3. miejsce",
};

export function fmtDateTime(d: Date | string | number | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}

export function fmtTime(d: Date | string | number): string {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}
