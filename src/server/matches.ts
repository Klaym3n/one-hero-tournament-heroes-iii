import "server-only";
import { and, eq, inArray, ne, or } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  disputes,
  matchReportGames,
  matchReports,
  matches,
  matchRevisions,
  participants,
  tournaments,
  users,
  type Match,
} from "@/db/schema";
import { mwdToIndex } from "@/lib/mwd";
import { validateReport, type ReportContext } from "@/lib/tournament/report";
import { getHeroes, getTemplates } from "@/lib/tournament/current";
import { notifyUsers } from "@/lib/notify";
import { publish } from "@/lib/realtime";
import { logAction } from "@/lib/audit";
import { hasRole } from "@/lib/authz";
import type { SessionUser } from "@/lib/auth/session";
import { ServiceError, ValidationFailed } from "./errors";
import { refreshProposalsForMatch } from "./scheduling";

const FINISHED = ["CONFIRMED", "WALKOVER"] as const;
export const isFinished = (s: Match["status"]) => (FINISHED as readonly string[]).includes(s);

type Snapshot = Pick<Match, "status" | "winnerId" | "scoreA" | "scoreB" | "playerAId" | "playerBId">;
const snap = (m: Match): Snapshot => ({
  status: m.status,
  winnerId: m.winnerId,
  scoreA: m.scoreA,
  scoreB: m.scoreB,
  playerAId: m.playerAId,
  playerBId: m.playerBId,
});

async function lockMatch(tx: Tx, matchId: string): Promise<Match> {
  const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
  if (!m) throw new ServiceError("Mecz nie istnieje.");
  return m;
}

async function revision(tx: Tx, matchId: string, editedById: string | null, action: string, before: unknown, after: unknown, reason?: string) {
  await tx.insert(matchRevisions).values({ matchId, editedById, action, before, after, reason });
}

/** user id graczy meczu */
async function playerUserIds(tx: Tx, m: Pick<Match, "playerAId" | "playerBId">): Promise<Record<"A" | "B", string | null>> {
  const ids = [m.playerAId, m.playerBId].filter(Boolean) as string[];
  const rows = ids.length
    ? await tx.select({ id: participants.id, userId: participants.userId }).from(participants).where(inArray(participants.id, ids))
    : [];
  const by = new Map(rows.map((r) => [r.id, r.userId]));
  return { A: m.playerAId ? (by.get(m.playerAId) ?? null) : null, B: m.playerBId ? (by.get(m.playerBId) ?? null) : null };
}

async function participantNick(tx: Tx, id: string | null): Promise<string> {
  if (!id) return "?";
  const [p] = await tx.select({ nick: participants.nick }).from(participants).where(eq(participants.id, id));
  return p?.nick ?? "?";
}

async function staffUserIds(tx: Tx): Promise<string[]> {
  const rows = await tx.select({ id: users.id }).from(users).where(inArray(users.role, ["ADMIN", "MODERATOR"]));
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Awans w drabince
// ---------------------------------------------------------------------------

/** Wstawia gracza do slotu kolejnego meczu; gdy obaj są znani → mecz do rozegrania. */
async function fillSlot(tx: Tx, matchId: string, slot: "A" | "B", participantId: string | null) {
  const target = await lockMatch(tx, matchId);
  const patch: Partial<Match> = slot === "A" ? { playerAId: participantId } : { playerBId: participantId };
  const a = slot === "A" ? participantId : target.playerAId;
  const b = slot === "B" ? participantId : target.playerBId;
  const ready = Boolean(a && b);
  patch.status = ready ? "PENDING" : "WAITING";
  await tx.update(matches).set(patch).where(eq(matches.id, matchId));

  if (ready) {
    // gracz wycofany/zbanowany → automatyczny walkower
    const ps = await tx
      .select({ id: participants.id, status: participants.status })
      .from(participants)
      .where(inArray(participants.id, [a!, b!]));
    const inactive = ps.filter((p) => p.status !== "ACTIVE").map((p) => p.id);
    if (inactive.length === 1) {
      const winner = inactive[0] === a ? b! : a!;
      await applyResult(tx, { ...target, ...patch } as Match, { winnerId: winner, walkover: true });
      return;
    }
    const uid = await playerUserIds(tx, { playerAId: a, playerBId: b });
    const [na, nb] = [await participantNick(tx, a), await participantNick(tx, b)];
    await notifyUsers([uid.A!, uid.B!].filter(Boolean), {
      type: "MATCH_READY",
      title: "Nowy mecz do rozegrania",
      body: `${na} vs ${nb} – umówcie termin i zgłoście wynik.`,
      href: `/mecze/${matchId}`,
    }, tx);
    await refreshProposalsForMatch(matchId, tx);
  }
}

/** Czy zmiana wyniku meczu wpłynie na rozpoczęte mecze dalej w drabince. */
async function downstreamStarted(tx: Tx, m: Match): Promise<boolean> {
  for (const id of [m.nextMatchId, m.loserNextMatchId]) {
    if (!id) continue;
    const [n] = await tx.select().from(matches).where(eq(matches.id, id));
    if (n && !["WAITING", "PENDING"].includes(n.status)) return true;
    if (n) {
      const [r] = await tx.select({ id: matchReports.id }).from(matchReports).where(eq(matchReports.matchId, n.id)).limit(1);
      if (r) return true;
    }
  }
  return false;
}

/** Cofa mecz (i rekurencyjnie jego następniki) do stanu oczekiwania. */
async function resetDownstream(tx: Tx, matchId: string, slot: "A" | "B") {
  const m = await lockMatch(tx, matchId);
  const wasFinished = isFinished(m.status);
  await tx
    .update(matches)
    .set({
      ...(slot === "A" ? { playerAId: null } : { playerBId: null }),
      status: "WAITING",
      winnerId: null,
      scoreA: 0,
      scoreB: 0,
      completedAt: null,
    })
    .where(eq(matches.id, matchId));
  await tx.update(matchReports).set({ status: "SUPERSEDED" }).where(and(eq(matchReports.matchId, matchId), ne(matchReports.status, "REJECTED")));
  await tx.update(disputes).set({ status: "RESOLVED", resolution: "Mecz cofnięty po korekcie wcześniejszego wyniku" }).where(and(eq(disputes.matchId, matchId), eq(disputes.status, "OPEN")));
  if (wasFinished) {
    if (m.nextMatchId && m.nextSlot) await resetDownstream(tx, m.nextMatchId, m.nextSlot);
    if (m.loserNextMatchId && m.loserNextSlot) await resetDownstream(tx, m.loserNextMatchId, m.loserNextSlot);
  }
}

type ResultInput = { winnerId: string; scoreA?: number; scoreB?: number; walkover?: boolean };

/** Zapisuje wynik meczu i przesuwa graczy w drabince. */
export async function applyResult(tx: Tx, m: Match, r: ResultInput, opts: { force?: boolean } = {}) {
  if (r.winnerId !== m.playerAId && r.winnerId !== m.playerBId) throw new ServiceError("Zwycięzca musi być uczestnikiem meczu.");
  const need = Math.ceil(m.bestOf / 2);
  const winnerIsA = r.winnerId === m.playerAId;
  const scoreA = r.walkover ? (winnerIsA ? need : 0) : (r.scoreA ?? 0);
  const scoreB = r.walkover ? (winnerIsA ? 0 : need) : (r.scoreB ?? 0);
  const loserId = winnerIsA ? m.playerBId : m.playerAId;

  if (isFinished(m.status) && m.stage !== "GROUP" && m.winnerId && m.winnerId !== r.winnerId) {
    // zmiana zwycięzcy w drabince
    if ((await downstreamStarted(tx, m)) && !opts.force) {
      throw new ServiceError("Kolejny mecz w drabince został już rozpoczęty. Użyj opcji wymuszenia, aby cofnąć zależne mecze.");
    }
    if (m.nextMatchId && m.nextSlot) await resetDownstream(tx, m.nextMatchId, m.nextSlot);
    if (m.loserNextMatchId && m.loserNextSlot) await resetDownstream(tx, m.loserNextMatchId, m.loserNextSlot);
  }

  await tx
    .update(matches)
    .set({ status: r.walkover ? "WALKOVER" : "CONFIRMED", winnerId: r.winnerId, scoreA, scoreB, completedAt: new Date() })
    .where(eq(matches.id, m.id));

  if (m.nextMatchId && m.nextSlot) await fillSlot(tx, m.nextMatchId, m.nextSlot, r.winnerId);
  if (m.loserNextMatchId && m.loserNextSlot) await fillSlot(tx, m.loserNextMatchId, m.loserNextSlot, loserId);

  // koniec turnieju: finał i mecz o 3. miejsce rozstrzygnięte
  if (m.stage !== "GROUP") {
    const ko = await tx
      .select({ status: matches.status, next: matches.nextMatchId, stage: matches.stage })
      .from(matches)
      .where(and(eq(matches.tournamentId, m.tournamentId), inArray(matches.stage, ["KNOCKOUT", "THIRD_PLACE"])));
    const decisive = ko.filter((x) => x.stage === "THIRD_PLACE" || x.next === null);
    if (decisive.length && decisive.every((x) => isFinished(x.status))) {
      await tx.update(tournaments).set({ phase: "FINISHED" }).where(eq(tournaments.id, m.tournamentId));
    }
  }
  await publish(["matches", `match:${m.id}`, m.stage === "GROUP" ? "groups" : "bracket", "players"], tx);
}

// ---------------------------------------------------------------------------
// Raporty
// ---------------------------------------------------------------------------

async function reportContext(m: Match): Promise<ReportContext> {
  const [heroes, templates] = await Promise.all([getHeroes(true), getTemplates(m.tournamentId, true)]);
  const heroesByFaction = new Map<string, Set<string>>();
  for (const h of heroes) {
    if (!heroesByFaction.has(h.faction)) heroesByFaction.set(h.faction, new Set());
    heroesByFaction.get(h.faction)!.add(h.slug);
  }
  return { bestOf: m.bestOf, heroesByFaction, activeTemplateIds: new Set(templates.map((t) => t.id)) };
}

async function sideOf(tx: Tx, m: Match, userId: string): Promise<"A" | "B" | null> {
  const uid = await playerUserIds(tx, m);
  if (uid.A === userId) return "A";
  if (uid.B === userId) return "B";
  return null;
}

async function insertReport(tx: Tx, m: Match, userId: string, raw: unknown, ctx: ReportContext, opts: { byStaff?: boolean; status?: "SUBMITTED" | "ACCEPTED" } = {}) {
  const v = validateReport(raw, ctx);
  if (!v.ok) throw new ValidationFailed(v.errors);
  const winnerId = v.value.winner === "A" ? m.playerAId! : m.playerBId!;
  const [rep] = await tx
    .insert(matchReports)
    .values({
      matchId: m.id,
      submittedById: userId,
      byStaff: opts.byStaff ?? false,
      status: opts.status ?? "SUBMITTED",
      winnerId,
      scoreA: v.value.scoreA,
      scoreB: v.value.scoreB,
      summary: v.value.summary,
      vodUrl: v.value.vodUrl,
      ...(opts.status === "ACCEPTED" ? { decidedAt: new Date(), decidedById: userId } : {}),
    })
    .returning();
  await tx.insert(matchReportGames).values(
    v.value.games.map((g, i) => ({
      reportId: rep.id,
      gameNo: i + 1,
      winnerId: g.winner === "A" ? m.playerAId! : m.playerBId!,
      mapTemplateId: g.mapTemplateId,
      factionA: g.factionA,
      factionB: g.factionB,
      heroA: g.heroA,
      heroB: g.heroB,
      endDay: mwdToIndex(g.day),
      notes: g.notes || null,
    })),
  );
  return { report: rep, value: v.value, winnerId };
}

/** Gracz zgłasza wynik meczu. */
export async function submitReport(user: SessionUser, matchId: string, raw: unknown) {
  const pre = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!pre[0]) throw new ServiceError("Mecz nie istnieje.");
  const ctx = await reportContext(pre[0]);

  return db.transaction(async (tx) => {
    const m = await lockMatch(tx, matchId);
    const side = await sideOf(tx, m, user.id);
    if (!side) throw new ServiceError("Nie jesteś uczestnikiem tego meczu.");
    if (!m.playerAId || !m.playerBId) throw new ServiceError("Mecz nie ma jeszcze obu graczy.");
    if (isFinished(m.status)) throw new ServiceError("Mecz jest już zatwierdzony.");
    if (m.status === "WAITING") throw new ServiceError("Mecz nie jest jeszcze gotowy do rozegrania.");

    const open = await tx
      .select()
      .from(matchReports)
      .where(and(eq(matchReports.matchId, m.id), eq(matchReports.status, "SUBMITTED")));
    const mine = open.filter((r) => r.submittedById === user.id);
    const theirs = open.filter((r) => r.submittedById !== user.id);

    // poprawka własnego raportu przed potwierdzeniem
    if (mine.length) {
      await tx.update(matchReports).set({ status: "SUPERSEDED" }).where(inArray(matchReports.id, mine.map((r) => r.id)));
    }
    const { report, value } = await insertReport(tx, m, user.id, raw, ctx);
    const uid = await playerUserIds(tx, m);
    const opponentUserId = side === "A" ? uid.B : uid.A;
    const myNick = await participantNick(tx, side === "A" ? m.playerAId : m.playerBId);
    const score = `${value.scoreA}:${value.scoreB}`;

    if (theirs.length || m.status === "DISPUTED") {
      // kontr-raport → spór
      if (m.status !== "DISPUTED") {
        await tx.insert(disputes).values({ matchId: m.id, openedById: user.id, reason: "Gracze złożyli różne raporty." });
        await tx.update(matches).set({ status: "DISPUTED" }).where(eq(matches.id, m.id));
        await notifyUsers(await staffUserIds(tx), {
          type: "DISPUTE",
          title: "Nowy spór do rozstrzygnięcia",
          body: `Gracze złożyli rozbieżne raporty meczu.`,
          href: `/admin/raporty/${m.id}`,
          discord: false,
        }, tx);
      }
      await revision(tx, m.id, user.id, "COUNTER_REPORT", snap(m), { reportId: report.id, score });
    } else {
      await tx.update(matches).set({ status: "REPORTED" }).where(eq(matches.id, m.id));
      await revision(tx, m.id, user.id, "REPORT_SUBMITTED", snap(m), { reportId: report.id, score });
    }

    if (opponentUserId) {
      await notifyUsers([opponentUserId], {
        type: "REPORT_TO_CONFIRM",
        title: "Potwierdź wynik meczu",
        body: `${myNick} zgłosił(a) wynik ${score}. Zaakceptuj raport lub zgłoś spór.`,
        href: `/mecze/${m.id}`,
      }, tx);
    }
    await publish([`match:${m.id}`, "matches", `user:${opponentUserId}`], tx);
    return report.id;
  });
}

/** Przeciwnik akceptuje raport → wynik zatwierdzony. */
export async function acceptReport(user: SessionUser, reportId: string) {
  return db.transaction(async (tx) => {
    const [rep] = await tx.select().from(matchReports).where(eq(matchReports.id, reportId));
    if (!rep) throw new ServiceError("Raport nie istnieje.");
    const m = await lockMatch(tx, rep.matchId);
    const side = await sideOf(tx, m, user.id);
    if (!side) throw new ServiceError("Nie jesteś uczestnikiem tego meczu.");
    if (rep.submittedById === user.id) throw new ServiceError("Nie możesz zatwierdzić własnego raportu.");
    if (rep.status !== "SUBMITTED" || m.status !== "REPORTED") throw new ServiceError("Ten raport nie czeka już na potwierdzenie.");

    await tx.update(matchReports).set({ status: "ACCEPTED", decidedAt: new Date(), decidedById: user.id }).where(eq(matchReports.id, rep.id));
    await revision(tx, m.id, user.id, "REPORT_ACCEPTED", snap(m), { reportId: rep.id, winnerId: rep.winnerId, scoreA: rep.scoreA, scoreB: rep.scoreB });
    await applyResult(tx, m, { winnerId: rep.winnerId, scoreA: rep.scoreA, scoreB: rep.scoreB });
    await notifyUsers([rep.submittedById], {
      type: "REPORT_ACCEPTED",
      title: "Wynik zatwierdzony",
      body: `Przeciwnik potwierdził Twój raport (${rep.scoreA}:${rep.scoreB}).`,
      href: `/mecze/${m.id}`,
      discord: false,
    }, tx);
  });
}

/** Przeciwnik kwestionuje raport → spór dla moderatora. */
export async function disputeReport(user: SessionUser, reportId: string, reason: string) {
  const text = reason.trim();
  if (text.length < 5) throw new ServiceError("Opisz krótko, co jest nie tak z raportem (min. 5 znaków).");
  return db.transaction(async (tx) => {
    const [rep] = await tx.select().from(matchReports).where(eq(matchReports.id, reportId));
    if (!rep) throw new ServiceError("Raport nie istnieje.");
    const m = await lockMatch(tx, rep.matchId);
    const side = await sideOf(tx, m, user.id);
    if (!side) throw new ServiceError("Nie jesteś uczestnikiem tego meczu.");
    if (rep.submittedById === user.id) throw new ServiceError("Nie możesz kwestionować własnego raportu.");
    if (m.status !== "REPORTED") throw new ServiceError("Ten mecz nie czeka na potwierdzenie.");

    await tx.insert(disputes).values({ matchId: m.id, openedById: user.id, reason: text.slice(0, 1000) });
    await tx.update(matches).set({ status: "DISPUTED" }).where(eq(matches.id, m.id));
    await revision(tx, m.id, user.id, "DISPUTE_OPENED", snap(m), { reportId: rep.id }, text);
    await notifyUsers(await staffUserIds(tx), {
      type: "DISPUTE",
      title: "Nowy spór do rozstrzygnięcia",
      body: text.slice(0, 200),
      href: `/admin/raporty/${m.id}`,
      discord: false,
    }, tx);
    await notifyUsers([rep.submittedById], {
      type: "REPORT_DISPUTED",
      title: "Twój raport został zakwestionowany",
      body: "Spór rozstrzygnie moderator. Możesz dodać szczegóły na Discordzie.",
      href: `/mecze/${m.id}`,
    }, tx);
    await publish([`match:${m.id}`, "matches"], tx);
  });
}

// ---------------------------------------------------------------------------
// Moderacja
// ---------------------------------------------------------------------------

function assertStaff(user: SessionUser) {
  if (!hasRole(user, "MODERATOR")) throw new ServiceError("Brak uprawnień.");
}

async function closeDisputes(tx: Tx, matchId: string, staffId: string, resolution: string) {
  await tx
    .update(disputes)
    .set({ status: "RESOLVED", resolvedById: staffId, resolution, resolvedAt: new Date() })
    .where(and(eq(disputes.matchId, matchId), eq(disputes.status, "OPEN")));
}

async function notifyPlayersResult(tx: Tx, m: Match, title: string, body: string) {
  const uid = await playerUserIds(tx, m);
  await notifyUsers([uid.A, uid.B].filter(Boolean) as string[], { type: "MATCH_DECIDED", title, body, href: `/mecze/${m.id}` }, tx);
}

/** Moderator wybiera jeden ze złożonych raportów jako obowiązujący. */
export async function staffAcceptReport(staff: SessionUser, reportId: string, resolution: string, force = false) {
  assertStaff(staff);
  return db.transaction(async (tx) => {
    const [rep] = await tx.select().from(matchReports).where(eq(matchReports.id, reportId));
    if (!rep) throw new ServiceError("Raport nie istnieje.");
    const m = await lockMatch(tx, rep.matchId);
    if (rep.status === "SUPERSEDED") throw new ServiceError("Ten raport został zastąpiony nowszym.");
    await tx
      .update(matchReports)
      .set({ status: "REJECTED", decidedAt: new Date(), decidedById: staff.id })
      .where(and(eq(matchReports.matchId, m.id), inArray(matchReports.status, ["SUBMITTED", "ACCEPTED"]), ne(matchReports.id, rep.id)));
    await tx.update(matchReports).set({ status: "ACCEPTED", decidedAt: new Date(), decidedById: staff.id }).where(eq(matchReports.id, rep.id));
    await applyResult(tx, m, { winnerId: rep.winnerId, scoreA: rep.scoreA, scoreB: rep.scoreB }, { force });
    await closeDisputes(tx, m.id, staff.id, resolution || "Zatwierdzono raport");
    const after = { winnerId: rep.winnerId, scoreA: rep.scoreA, scoreB: rep.scoreB, reportId: rep.id };
    await revision(tx, m.id, staff.id, "STAFF_ACCEPT", snap(m), after, resolution);
    await logAction(staff.id, m.status === "DISPUTED" ? "DISPUTE_RESOLVED" : "MATCH_EDIT", { entityType: "match", entityId: m.id, payload: { before: snap(m), after, resolution } }, tx);
    await notifyPlayersResult(tx, m, "Decyzja moderatora", `Wynik meczu ustalony: ${rep.scoreA}:${rep.scoreB}. ${resolution}`.trim());
  });
}

/** Moderator wprowadza/koryguje wynik własnym raportem. */
export async function staffSetResult(staff: SessionUser, matchId: string, raw: unknown, reason: string, force = false) {
  assertStaff(staff);
  if (reason.trim().length < 3) throw new ServiceError("Podaj powód korekty.");
  const [pre] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!pre) throw new ServiceError("Mecz nie istnieje.");
  const ctx = await reportContext(pre);
  return db.transaction(async (tx) => {
    const m = await lockMatch(tx, matchId);
    if (!m.playerAId || !m.playerBId) throw new ServiceError("Mecz nie ma jeszcze obu graczy.");
    await tx
      .update(matchReports)
      .set({ status: "SUPERSEDED" })
      .where(and(eq(matchReports.matchId, m.id), inArray(matchReports.status, ["SUBMITTED", "ACCEPTED"])));
    const { report, value, winnerId } = await insertReport(tx, m, staff.id, raw, ctx, { byStaff: true, status: "ACCEPTED" });
    await applyResult(tx, m, { winnerId, scoreA: value.scoreA, scoreB: value.scoreB }, { force });
    await closeDisputes(tx, m.id, staff.id, reason);
    const after = { winnerId, scoreA: value.scoreA, scoreB: value.scoreB, reportId: report.id };
    await revision(tx, m.id, staff.id, "STAFF_EDIT", snap(m), after, reason);
    await logAction(staff.id, "MATCH_EDIT", { entityType: "match", entityId: m.id, payload: { before: snap(m), after, reason } }, tx);
    await notifyPlayersResult(tx, m, "Wynik meczu skorygowany", `Nowy wynik: ${value.scoreA}:${value.scoreB}. Powód: ${reason}`);
  });
}

export async function staffWalkover(staff: SessionUser, matchId: string, winnerSide: "A" | "B", reason: string, force = false) {
  assertStaff(staff);
  if (reason.trim().length < 3) throw new ServiceError("Podaj powód walkowera.");
  return db.transaction(async (tx) => {
    const m = await lockMatch(tx, matchId);
    const winnerId = winnerSide === "A" ? m.playerAId : m.playerBId;
    if (!winnerId) throw new ServiceError("Brak gracza po tej stronie.");
    await tx
      .update(matchReports)
      .set({ status: "SUPERSEDED" })
      .where(and(eq(matchReports.matchId, m.id), inArray(matchReports.status, ["SUBMITTED", "ACCEPTED"])));
    await applyResult(tx, m, { winnerId, walkover: true }, { force });
    await closeDisputes(tx, m.id, staff.id, reason);
    await revision(tx, m.id, staff.id, "WALKOVER", snap(m), { winnerId }, reason);
    await logAction(staff.id, "MATCH_WALKOVER", { entityType: "match", entityId: m.id, payload: { winnerId, reason } }, tx);
    await notifyPlayersResult(tx, m, "Walkower", `Mecz rozstrzygnięty walkowerem. Powód: ${reason}`);
  });
}

/** Cofa mecz do stanu "do rozegrania" (np. po błędnym zatwierdzeniu). */
export async function staffResetMatch(staff: SessionUser, matchId: string, reason: string, force = false) {
  assertStaff(staff);
  if (reason.trim().length < 3) throw new ServiceError("Podaj powód.");
  return db.transaction(async (tx) => {
    const m = await lockMatch(tx, matchId);
    if (m.stage !== "GROUP" && isFinished(m.status)) {
      if ((await downstreamStarted(tx, m)) && !force) throw new ServiceError("Kolejny mecz w drabince został już rozpoczęty. Użyj wymuszenia.");
      if (m.nextMatchId && m.nextSlot) await resetDownstream(tx, m.nextMatchId, m.nextSlot);
      if (m.loserNextMatchId && m.loserNextSlot) await resetDownstream(tx, m.loserNextMatchId, m.loserNextSlot);
    }
    await tx
      .update(matches)
      .set({ status: m.playerAId && m.playerBId ? "PENDING" : "WAITING", winnerId: null, scoreA: 0, scoreB: 0, completedAt: null })
      .where(eq(matches.id, m.id));
    await tx
      .update(matchReports)
      .set({ status: "SUPERSEDED" })
      .where(and(eq(matchReports.matchId, m.id), inArray(matchReports.status, ["SUBMITTED", "ACCEPTED"])));
    await closeDisputes(tx, m.id, staff.id, `Mecz zresetowany: ${reason}`);
    await revision(tx, m.id, staff.id, "RESET", snap(m), null, reason);
    await logAction(staff.id, "MATCH_RESET", { entityType: "match", entityId: m.id, payload: { before: snap(m), reason } }, tx);
    await tx.update(tournaments).set({ phase: m.stage === "GROUP" ? "GROUPS" : "KNOCKOUT" }).where(and(eq(tournaments.id, m.tournamentId), eq(tournaments.phase, "FINISHED")));
    await publish(["matches", `match:${m.id}`, m.stage === "GROUP" ? "groups" : "bracket"], tx);
  });
}

// ---------------------------------------------------------------------------
// Terminy
// ---------------------------------------------------------------------------

export async function setSchedule(user: SessionUser, matchId: string, when: Date | null) {
  return db.transaction(async (tx) => {
    const m = await lockMatch(tx, matchId);
    const side = await sideOf(tx, m, user.id);
    const staff = hasRole(user, "MODERATOR");
    if (!side && !staff) throw new ServiceError("Nie jesteś uczestnikiem tego meczu.");
    if (isFinished(m.status)) throw new ServiceError("Mecz jest już rozegrany.");
    if (when && when.getTime() < Date.now() - 3_600_000) throw new ServiceError("Termin nie może być w przeszłości.");
    await tx.update(matches).set({ scheduledAt: when, scheduledById: user.id }).where(eq(matches.id, m.id));
    await revision(tx, m.id, user.id, "SCHEDULE", { scheduledAt: m.scheduledAt }, { scheduledAt: when });
    if (staff && !side) await logAction(user.id, "SCHEDULE_SET", { entityType: "match", entityId: m.id, payload: { when } }, tx);
    const uid = await playerUserIds(tx, m);
    const others = [uid.A, uid.B].filter((u) => u && u !== user.id) as string[];
    const label = when
      ? new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "full", timeStyle: "short" }).format(when)
      : null;
    await notifyUsers(others, {
      type: "SCHEDULE",
      title: when ? "Ustalono termin meczu" : "Termin meczu usunięty",
      body: when ? `Planowany start: ${label} (czas polski).` : "Termin meczu został wyczyszczony.",
      href: `/mecze/${m.id}`,
    }, tx);
    await publish([`match:${m.id}`, "matches"], tx);
  });
}

/** Mecze gracza (do UI). */
export function playerMatchFilter(participantId: string) {
  return or(eq(matches.playerAId, participantId), eq(matches.playerBId, participantId));
}
