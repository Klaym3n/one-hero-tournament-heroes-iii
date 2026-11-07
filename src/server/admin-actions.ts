"use server";

import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { discordOutbox, phaseEnum, roleEnum } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { parseWarsawLocal } from "@/lib/time";
import { log } from "@/lib/log";
import { fmtDateTime } from "@/lib/labels";
import { run, ServiceError } from "./errors";
import { matchLogLabel } from "./queries";
import * as T from "./tournament";
import * as M from "./matches";
import * as C from "./content";
import * as D from "./demo";

const uuid = z.string().uuid();
const reason = z.string().trim().max(500);

// ---------- Turniej (Administrator) ----------
export async function setPhaseAction(phase: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.setPhase(admin, z.enum(phaseEnum.enumValues).parse(phase));
    log.info("panel", `zmienił(a) fazę turnieju na ${phase}`, admin);
    refresh();
  }, "Zmieniono fazę turnieju.");
}

export async function drawGroupsAction(groupCount: number) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.drawTournamentGroups(admin, z.number().int().min(1).max(512).parse(groupCount));
    log.info("panel", `wylosował(a) grupy (${groupCount})`, admin);
    refresh();
  }, "Grupy zostały wylosowane.");
}

export async function resetGroupsAction() {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.resetGroups(admin);
    log.info("panel", "usunął(-ęła) grupy i mecze grupowe", admin);
    refresh();
  }, "Grupy i mecze grupowe usunięte.");
}

export async function setTiebreakAction(groupId: string, order: string[]) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.setGroupTiebreak(admin, uuid.parse(groupId), z.array(uuid).max(20).parse(order));
    log.info("panel", `ustalił(a) kolejność w grupie #${groupId.slice(0, 8)}`, admin);
    refresh();
  }, "Zapisano kolejność w grupie.");
}

export async function generateBracketAction(force: boolean) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.generateBracket(admin, z.boolean().parse(force));
    log.info("panel", `wygenerował(a) drabinkę${force ? " (wymuszenie)" : ""}`, admin);
    refresh();
  }, "Drabinka wygenerowana.");
}

export async function previewRoundPingAction(label: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    return T.previewRoundPing(admin, z.string().max(100).parse(label));
  });
}

export async function pingRoundAction(label: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const r = await T.pingCurrentRound(admin, z.string().max(100).parse(label));
    log.info("panel", `wysłał(a) powiadomienie o rundzie „${label}”`, admin);
    refresh();
    return r;
  }, "Wiadomość dodana do kolejki Discord.");
}

// ---------- Użytkownicy (Administrator) ----------
export async function setRoleAction(userId: string, role: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.setUserRole(admin, uuid.parse(userId), z.enum(roleEnum.enumValues).parse(role));
    log.info("panel", `zmienił(a) rolę użytkownika #${userId.slice(0, 8)} na ${role}`, admin);
    refresh();
  }, "Zmieniono rolę.");
}

export async function banAction(userId: string, banned: boolean, why: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.setUserBan(admin, uuid.parse(userId), z.boolean().parse(banned), reason.parse(why));
    log.info("panel", `${banned ? "zbanował(a)" : "odbanował(a)"} użytkownika #${userId.slice(0, 8)}${why ? ` – „${why}”` : ""}`, admin);
    refresh();
  }, banned ? "Użytkownik zbanowany." : "Ban zdjęty.");
}

export async function removeParticipantAction(participantId: string, why: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.removeParticipant(admin, uuid.parse(participantId), reason.parse(why));
    log.info("panel", `usunął(-ęła) gracza #${participantId.slice(0, 8)} z turnieju – „${why}”`, admin);
    refresh();
  }, "Gracz usunięty z turnieju (nierozegrane mecze – walkower).");
}

export async function restoreParticipantAction(participantId: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await T.restoreParticipant(admin, uuid.parse(participantId));
    log.info("panel", `przywrócił(a) gracza #${participantId.slice(0, 8)}`, admin);
    refresh();
  }, "Gracz przywrócony.");
}

// ---------- Konfiguracja (Administrator) ----------
const bo = z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7)]);
/** Adres grafiki: https albo plik z public/assets, public/brand lub ASSETS_DIR (/grafika/…); pusty → null. */
const imageUrl = (message: string) =>
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^(https:\/\/[^\s"'()<>]+|\/(assets|brand|grafika)\/[\w-]+(\/[\w-]+)*\.(png|jpg|jpeg|webp|gif|svg))$/.test(v), message)
    .transform((v) => v || null);
const configSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    tagline: z.string().max(300),
    bannerUrl: imageUrl("Nieprawidłowy adres baneru"),
    infoMd: z.string().max(20_000),
    rulesMd: z.string().max(50_000),
    privacyMd: z.string().max(50_000),
    prizesMd: z.string().max(10_000),
    scheduleMd: z.string().max(10_000),
    formatMd: z.string().max(10_000),
    gameSettings: z.object({
      chessClock: z.string().trim().max(200),
      roads: z.string().trim().max(200),
      monsterStrength: z.string().trim().max(200),
      difficulty: z.string().trim().max(200),
      finalBattle: z.string().trim().max(200),
    }),
    groupBestOf: bo,
    knockoutBestOf: bo,
    finalBestOf: bo,
    thirdPlaceBestOf: bo,
    minSlotMinutes: z.number().int(),
    currentRoundLabel: z
      .string()
      .max(100)
      .transform((v) => v || null),
    rulesVersionLabel: z.string().trim().max(30),
    rulesUpdatedAt: z
      .string()
      .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Nieprawidłowa data aktualizacji regulaminu")
      .transform((v) => v || null),
  })
  .partial();

export async function updateConfigAction(input: unknown) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const parsed = configSchema.safeParse(input);
    if (!parsed.success) throw new ServiceError(parsed.error.issues[0]?.message ?? "Nieprawidłowe dane.");
    await T.updateConfig(admin, parsed.data);
    log.info("panel", `zmienił(a) konfigurację: ${Object.keys(parsed.data).join(", ")}`, admin);
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
    log.info("panel", `zapisał(a) szablon mapy „${v.name}”`, admin);
    refresh();
  }, "Zapisano szablon.");
}

export async function deleteTemplateAction(id: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await C.deleteTemplate(admin, uuid.parse(id));
    log.info("panel", `dezaktywował(a) szablon mapy #${id.slice(0, 8)}`, admin);
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
    log.info("panel", `zapisał(a) bohatera „${v.name}”`, admin);
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
    log.info("panel", `zapisał(a) ogłoszenie „${v.title}”`, admin);
    refresh();
  }, "Zapisano ogłoszenie.");
}

export async function deleteAnnouncementAction(id: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await C.deleteAnnouncement(admin, uuid.parse(id));
    log.info("panel", `usunął(-ęła) ogłoszenie #${id.slice(0, 8)}`, admin);
    refresh();
  }, "Usunięto ogłoszenie.");
}

export async function savePartnerAction(input: { id?: string; name: string; tier: string; url: string; logoUrl: string; active: boolean; sortOrder: number }) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    const parsed = z
      .object({
        id: uuid.optional(),
        name: z.string().max(80),
        tier: z.string().max(60),
        url: z
          .string()
          .trim()
          .max(500)
          .refine((v) => v === "" || /^https?:\/\/[^\s"'<>]+$/.test(v), "Nieprawidłowy adres strony partnera")
          .transform((v) => v || null),
        logoUrl: imageUrl("Nieprawidłowy adres logo"),
        active: z.boolean(),
        sortOrder: z.number().int(),
      })
      .safeParse(input);
    if (!parsed.success) throw new ServiceError(parsed.error.issues[0]?.message ?? "Nieprawidłowe dane.");
    await C.savePartner(admin, parsed.data);
    log.info("panel", `zapisał(a) partnera „${parsed.data.name}”`, admin);
    refresh();
  }, "Zapisano partnera.");
}

export async function deletePartnerAction(id: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await C.deletePartner(admin, uuid.parse(id));
    log.info("panel", `usunął(-ęła) partnera #${id.slice(0, 8)}`, admin);
    refresh();
  }, "Usunięto partnera.");
}

export async function retryOutboxAction(id: string) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    await db
      .update(discordOutbox)
      .set({ failedAt: null, attempts: 0, nextAttemptAt: new Date(), lastError: null })
      .where(eq(discordOutbox.id, uuid.parse(id)));
    log.info("panel", `ponowił(a) wysyłkę wiadomości Discord #${id.slice(0, 8)}`, admin);
    refresh();
  }, "Wiadomość ponownie w kolejce.");
}

// ---------- Dane demo (Administrator, tylko przy ALLOW_DEMO_DATA=true) ----------
export async function seedDemoAction(players: number, bracket: boolean) {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    if (!D.demoDataEnabled()) throw new ServiceError("Dane demo są wyłączone (zmienna ALLOW_DEMO_DATA).");
    const n = z.number().int().min(4).max(D.DEMO_MAX_PLAYERS).parse(players);
    log.info("panel", `wczytuje dane demo (${n} graczy${bracket ? ", z drabinką" : ""})…`, admin);
    const summary = await D.seedDemo(admin, { players: n, bracket: z.boolean().parse(bracket) });
    log.info("panel", `wczytał(a) dane demo: ${summary}`, admin);
    refresh();
    return summary;
  }, "Wczytano dane demo.");
}

export async function clearDemoAction() {
  return run(async () => {
    const admin = await requireRole("ADMIN");
    if (!D.demoDataEnabled()) throw new ServiceError("Dane demo są wyłączone (zmienna ALLOW_DEMO_DATA).");
    const removed = await D.clearDemo(admin);
    log.info("panel", `usunął(-ęła) dane demo (kont demo: ${removed}, wszystkie mecze i grupy)`, admin);
    refresh();
  }, "Usunięto dane demo. Turniej wrócił do fazy zapisów.");
}

// ---------- Moderacja (Moderator i Administrator) ----------
export async function staffAcceptReportAction(reportId: string, resolution: string, force = false) {
  return run(async () => {
    const staff = await requireRole("MODERATOR");
    await M.staffAcceptReport(staff, uuid.parse(reportId), reason.parse(resolution), z.boolean().parse(force));
    log.info("moderacja", `zatwierdził(a) raport: ${await matchLogLabel({ reportId })}`, staff);
    refresh();
  }, "Raport zatwierdzony.");
}

export async function staffSetResultAction(matchId: string, report: unknown, why: string, force = false) {
  return run(async () => {
    const staff = await requireRole("MODERATOR");
    await M.staffSetResult(staff, uuid.parse(matchId), report, reason.parse(why), z.boolean().parse(force));
    log.info("moderacja", `wprowadził(a) wynik: ${await matchLogLabel({ matchId })} – „${why}”`, staff);
    refresh();
  }, "Wynik zapisany.");
}

export async function staffWalkoverAction(matchId: string, side: "A" | "B", why: string, force = false) {
  return run(async () => {
    const staff = await requireRole("MODERATOR");
    await M.staffWalkover(staff, uuid.parse(matchId), z.enum(["A", "B"]).parse(side), reason.parse(why), z.boolean().parse(force));
    log.info("moderacja", `przyznał(a) walkower: ${await matchLogLabel({ matchId })} – „${why}”`, staff);
    refresh();
  }, "Walkower zapisany.");
}

export async function staffResetMatchAction(matchId: string, why: string, force = false) {
  return run(async () => {
    const staff = await requireRole("MODERATOR");
    await M.staffResetMatch(staff, uuid.parse(matchId), reason.parse(why), z.boolean().parse(force));
    log.info("moderacja", `zresetował(a) mecz: ${await matchLogLabel({ matchId })} – „${why}”`, staff);
    refresh();
  }, "Mecz zresetowany.");
}

export async function staffScheduleAction(matchId: string, local: string | null) {
  return run(async () => {
    const staff = await requireRole("MODERATOR");
    const when = local ? parseWarsawLocal(local) : null;
    if (local && !when) throw new ServiceError("Nieprawidłowa data.");
    await M.setSchedule(staff, uuid.parse(matchId), when);
    log.info("moderacja", `${when ? `ustawił(a) termin ${fmtDateTime(when)}` : "usunął(-ęła) termin"}: ${await matchLogLabel({ matchId })}`, staff);
    refresh();
  }, "Termin zapisany.");
}
