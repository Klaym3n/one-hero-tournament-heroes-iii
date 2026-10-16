"use server";

import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { discordOutbox, phaseEnum, roleEnum } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { parseWarsawLocal } from "@/lib/time";
import { run, ServiceError } from "./errors";
import * as T from "./tournament";
import * as M from "./matches";
import * as C from "./content";

const uuid = z.string().uuid();
const reason = z.string().trim().max(500);

// ---------- Turniej (Administrator) ----------
export async function setPhaseAction(phase: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.setPhase(admin, z.enum(phaseEnum.enumValues).parse(phase));
    refresh();
  }, "Zmieniono fazę turnieju.");
}

export async function drawGroupsAction(groupCount: number) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.drawTournamentGroups(admin, z.number().int().min(1).max(512).parse(groupCount));
    refresh();
  }, "Grupy zostały wylosowane.");
}

export async function resetGroupsAction() {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.resetGroups(admin);
    refresh();
  }, "Grupy i mecze grupowe usunięte.");
}

export async function setTiebreakAction(groupId: string, order: string[]) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.setGroupTiebreak(admin, uuid.parse(groupId), z.array(uuid).max(20).parse(order));
    refresh();
  }, "Zapisano kolejność w grupie.");
}

export async function generateBracketAction(force: boolean) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.generateBracket(admin, z.boolean().parse(force));
    refresh();
  }, "Drabinka wygenerowana.");
}

export async function pingRoundAction(label: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const r = await T.pingCurrentRound(admin, z.string().max(100).parse(label));
    refresh();
    return r;
  }, "Wiadomość dodana do kolejki Discord.");
}

// ---------- Użytkownicy (Administrator) ----------
export async function setRoleAction(userId: string, role: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.setUserRole(admin, uuid.parse(userId), z.enum(roleEnum.enumValues).parse(role));
    refresh();
  }, "Zmieniono rolę.");
}

export async function banAction(userId: string, banned: boolean, why: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.setUserBan(admin, uuid.parse(userId), z.boolean().parse(banned), reason.parse(why));
    refresh();
  }, banned ? "Użytkownik zbanowany." : "Ban zdjęty.");
}

export async function removeParticipantAction(participantId: string, why: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.removeParticipant(admin, uuid.parse(participantId), reason.parse(why));
    refresh();
  }, "Gracz usunięty z turnieju (nierozegrane mecze – walkower).");
}

export async function restoreParticipantAction(participantId: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.restoreParticipant(admin, uuid.parse(participantId));
    refresh();
  }, "Gracz przywrócony.");
}

// ---------- Konfiguracja (Administrator) ----------
const bo = z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7)]);
const configSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    tagline: z.string().max(300),
    bannerUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === "" || /^(https:\/\/[^\s"'()<>]+|\/(assets|grafika)\/[\w-]+(\/[\w-]+)*\.(png|jpg|jpeg|webp|gif|svg))$/.test(v), "Nieprawidłowy adres baneru")
      .transform((v) => v || null),
    infoMd: z.string().max(20_000),
    rulesMd: z.string().max(50_000),
    privacyMd: z.string().max(50_000),
    prizesMd: z.string().max(10_000),
    scheduleMd: z.string().max(10_000),
    formatMd: z.string().max(10_000),
    gameSettings: z.object({ difficulty: z.string().max(200), turnTimer: z.string().max(200), handicap: z.string().max(200), other: z.string().max(1000) }),
    groupBestOf: bo,
    knockoutBestOf: bo,
    finalBestOf: bo,
    thirdPlaceBestOf: bo,
    minSlotMinutes: z.number().int(),
    currentRoundLabel: z
      .string()
      .max(100)
      .transform((v) => v || null),
  })
  .partial();

export async function updateConfigAction(input: unknown) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const parsed = configSchema.safeParse(input);
    if (!parsed.success) throw new ServiceError(parsed.error.issues[0]?.message ?? "Nieprawidłowe dane.");
    await T.updateConfig(admin, parsed.data);
    refresh();
  }, "Zapisano.");
}

export async function saveTemplateAction(input: { id?: string; name: string; description: string; active: boolean; sortOrder: number }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const v = z
      .object({ id: uuid.optional(), name: z.string().max(60), description: z.string().max(300), active: z.boolean(), sortOrder: z.number().int() })
      .parse(input);
    await C.saveTemplate(admin, v);
    refresh();
  }, "Zapisano szablon.");
}

export async function deleteTemplateAction(id: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await C.deleteTemplate(admin, uuid.parse(id));
    refresh();
  }, "Szablon dezaktywowany.");
}

export async function saveHeroAction(input: { slug?: string; name: string; faction: string; heroClass: number; active: boolean }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const v = z
      .object({ slug: z.string().max(80).optional(), name: z.string().max(40), faction: z.string().max(20), heroClass: z.number().int(), active: z.boolean() })
      .parse(input);
    await C.saveHero(admin, v);
    refresh();
  }, "Zapisano bohatera.");
}

export async function saveAnnouncementAction(input: { id?: string; title: string; bodyMd: string; pinned: boolean; published: boolean }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const v = z
      .object({ id: uuid.optional(), title: z.string().max(120), bodyMd: z.string().max(10_000), pinned: z.boolean(), published: z.boolean() })
      .parse(input);
    await C.saveAnnouncement(admin, v);
    refresh();
  }, "Zapisano ogłoszenie.");
}

export async function deleteAnnouncementAction(id: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await C.deleteAnnouncement(admin, uuid.parse(id));
    refresh();
  }, "Usunięto ogłoszenie.");
}

export async function retryOutboxAction(id: string) {
  return run(async () => {
    await requireRole("ADMIN");
    await db
      .update(discordOutbox)
      .set({ failedAt: null, attempts: 0, nextAttemptAt: new Date(), lastError: null })
      .where(eq(discordOutbox.id, uuid.parse(id)));
    refresh();
  }, "Wiadomość ponownie w kolejce.");
}

// ---------- Moderacja (Moderator i Administrator) ----------
export async function staffAcceptReportAction(reportId: string, resolution: string, force = false) {
  return run(async () => {
    const staff = await requireRole("MODERATOR");
    await M.staffAcceptReport(staff, uuid.parse(reportId), reason.parse(resolution), z.boolean().parse(force));
    refresh();
  }, "Raport zatwierdzony.");
}

export async function staffSetResultAction(matchId: string, report: unknown, why: string, force = false) {
  return run(async () => {
    const staff = await requireRole("MODERATOR");
    await M.staffSetResult(staff, uuid.parse(matchId), report, reason.parse(why), z.boolean().parse(force));
    refresh();
  }, "Wynik zapisany.");
}

export async function staffWalkoverAction(matchId: string, side: "A" | "B", why: string, force = false) {
  return run(async () => {
    const staff = await requireRole("MODERATOR");
    await M.staffWalkover(staff, uuid.parse(matchId), z.enum(["A", "B"]).parse(side), reason.parse(why), z.boolean().parse(force));
    refresh();
  }, "Walkower zapisany.");
}

export async function staffResetMatchAction(matchId: string, why: string, force = false) {
  return run(async () => {
    const staff = await requireRole("MODERATOR");
    await M.staffResetMatch(staff, uuid.parse(matchId), reason.parse(why), z.boolean().parse(force));
    refresh();
  }, "Mecz zresetowany.");
}

export async function staffScheduleAction(matchId: string, local: string | null) {
  return run(async () => {
    const staff = await requireRole("MODERATOR");
    const when = local ? parseWarsawLocal(local) : null;
    if (local && !when) throw new ServiceError("Nieprawidłowa data.");
    await M.setSchedule(staff, uuid.parse(matchId), when);
    refresh();
  }, "Termin zapisany.");
}
