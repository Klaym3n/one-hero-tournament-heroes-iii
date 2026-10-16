"use server";

import { refresh } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { parseWarsawLocal } from "@/lib/time";
import { run, ServiceError } from "./errors";
import * as T from "./tournament";
import * as M from "./matches";
import * as S from "./scheduling";

const uuid = z.string().uuid();

export async function registerAction(input: { nick: string; acceptRules: boolean; acceptPrivacy: boolean }) {
  return run(async () => {
    const user = await requireUser();
    const parsed = z.object({ nick: z.string().max(40), acceptRules: z.boolean(), acceptPrivacy: z.boolean() }).parse(input);
    const res = await T.register(user, parsed);
    refresh();
    return res;
  });
}

export async function withdrawAction() {
  return run(async () => {
    const user = await requireUser();
    await T.withdraw(user);
    refresh();
  }, "Wypisano z turnieju.");
}

export async function updateProfileAction(input: { nick?: string; youtubeUrl?: string; twitchUrl?: string; kickUrl?: string; bio?: string }) {
  return run(async () => {
    const user = await requireUser();
    const parsed = z
      .object({
        nick: z.string().max(40).optional(),
        youtubeUrl: z.string().max(300).optional(),
        twitchUrl: z.string().max(300).optional(),
        kickUrl: z.string().max(300).optional(),
        bio: z.string().max(600).optional(),
      })
      .parse(input);
    await T.updateProfile(user, parsed);
    refresh();
  }, "Zapisano profil.");
}

export async function submitReportAction(matchId: string, report: unknown) {
  return run(async () => {
    const user = await requireUser();
    const id = await M.submitReport(user, uuid.parse(matchId), report);
    refresh();
    return id;
  }, "Raport wysłany. Przeciwnik otrzymał prośbę o potwierdzenie.");
}

export async function acceptReportAction(reportId: string) {
  return run(async () => {
    const user = await requireUser();
    await M.acceptReport(user, uuid.parse(reportId));
    refresh();
  }, "Wynik zatwierdzony.");
}

export async function disputeReportAction(reportId: string, reason: string) {
  return run(async () => {
    const user = await requireUser();
    await M.disputeReport(user, uuid.parse(reportId), z.string().max(1000).parse(reason));
    refresh();
  }, "Zgłoszono spór. Moderator rozstrzygnie sprawę.");
}

export async function setScheduleAction(matchId: string, local: string | null) {
  return run(async () => {
    const user = await requireUser();
    let when: Date | null = null;
    if (local) {
      when = parseWarsawLocal(local);
      if (!when) throw new ServiceError("Nieprawidłowa data.");
    }
    await M.setSchedule(user, uuid.parse(matchId), when);
    refresh();
  }, "Zapisano termin meczu.");
}

export async function setScheduleFromProposalAction(matchId: string, startsAtIso: string) {
  return run(async () => {
    const user = await requireUser();
    const when = new Date(z.string().datetime().parse(startsAtIso));
    await M.setSchedule(user, uuid.parse(matchId), when);
    refresh();
  }, "Termin ustawiony.");
}

export async function saveAvailabilityAction(fromIso: string, toIso: string, intervals: { start: number; end: number }[]) {
  return run(async () => {
    const user = await requireUser();
    const parsed = z
      .object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        intervals: z.array(z.object({ start: z.number().int(), end: z.number().int() })).max(400),
      })
      .parse({ from: fromIso, to: toIso, intervals });
    await S.saveAvailability(user, new Date(parsed.from), new Date(parsed.to), parsed.intervals);
  }, "Zapisano dostępność.");
}

export async function markNotificationsReadAction() {
  return run(async () => {
    const user = await requireUser();
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    refresh();
  });
}
