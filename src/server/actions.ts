"use server";

import { refresh } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { parseWarsawLocal } from "@/lib/time";
import { log } from "@/lib/log";
import { fmtDate, fmtDateTime } from "@/lib/labels";
import { matchLogLabel } from "./queries";
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
    if (res.status === "registered") log.info("zapisy", `zapisał(a) się do turnieju jako „${parsed.nick.trim()}”`, user);
    else log.info("zapisy", "zapis wstrzymany – konto nie jest na serwerze Discord", user);
    refresh();
    return res;
  });
}

export async function withdrawAction() {
  return run(async () => {
    const user = await requireUser();
    await T.withdraw(user);
    log.info("zapisy", "wypisał(a) się z turnieju", user);
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
    log.info("profil", "zaktualizował(a) profil", user);
    refresh();
  }, "Zapisano profil.");
}

export async function submitReportAction(matchId: string, report: unknown) {
  return run(async () => {
    const user = await requireUser();
    const id = await M.submitReport(user, uuid.parse(matchId), report);
    log.info("mecz", `zgłosił(a) wynik: ${await matchLogLabel({ reportId: id })}`, user);
    refresh();
    return id;
  }, "Raport wysłany. Przeciwnik otrzymał prośbę o potwierdzenie.");
}

export async function acceptReportAction(reportId: string) {
  return run(async () => {
    const user = await requireUser();
    await M.acceptReport(user, uuid.parse(reportId));
    log.info("mecz", `potwierdził(a) wynik: ${await matchLogLabel({ reportId })}`, user);
    refresh();
  }, "Wynik zatwierdzony.");
}

export async function disputeReportAction(reportId: string, reason: string) {
  return run(async () => {
    const user = await requireUser();
    await M.disputeReport(user, uuid.parse(reportId), z.string().max(1000).parse(reason));
    log.info("mecz", `zgłosił(a) spór: ${await matchLogLabel({ reportId })} – „${reason.trim().slice(0, 200)}”`, user);
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
    log.info("terminy", `${when ? `ustawił(a) termin ${fmtDateTime(when)}` : "usunął(-ęła) termin"}: ${await matchLogLabel({ matchId })}`, user);
    refresh();
  }, "Zapisano termin meczu.");
}

export async function setScheduleFromProposalAction(matchId: string, startsAtIso: string) {
  return run(async () => {
    const user = await requireUser();
    const when = new Date(z.string().datetime().parse(startsAtIso));
    await M.setSchedule(user, uuid.parse(matchId), when);
    log.info("terminy", `wybrał(a) proponowany termin ${fmtDateTime(when)}: ${await matchLogLabel({ matchId })}`, user);
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
    const hours = parsed.intervals.reduce((sum, i) => sum + (i.end - i.start), 0) / 3_600_000;
    log.info("dostępność", `zapisał(a) dostępność na tydzień od ${fmtDate(parsed.from)}: ${hours} h w ${parsed.intervals.length} przedziałach`, user);
  }, "Zapisano dostępność.");
}

export async function markNotificationsReadAction() {
  return run(async () => {
    const user = await requireUser();
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    refresh();
  });
}
