import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAuditLog,
  announcements,
  disputes,
  discordOutbox,
  groupMembers,
  groups,
  heroes,
  mapTemplates,
  matchReportGames,
  matchReports,
  matches,
  matchRevisions,
  notifications,
  participants,
  slotProposals,
  users,
  type Match,
} from "@/db/schema";
import { roundName } from "@/lib/tournament/bracket";
import { isFinished } from "./matches";

export type PlayerLite = { id: string; nick: string; avatarUrl: string | null; status: string; discordUsername?: string };

export async function playersById(ids: (string | null)[]): Promise<Map<string, PlayerLite>> {
  const uniq = [...new Set(ids.filter(Boolean) as string[])];
  if (!uniq.length) return new Map();
  const rows = await db
    .select({ id: participants.id, nick: participants.nick, avatarUrl: users.avatarUrl, status: participants.status, discordUsername: users.discordUsername })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .where(inArray(participants.id, uniq));
  return new Map(rows.map((r) => [r.id, r]));
}

export type MatchView = Match & {
  a: PlayerLite | null;
  b: PlayerLite | null;
  groupName: string | null;
  label: string;
};

async function knockoutRounds(tournamentId: string): Promise<number> {
  const [r] = await db
    .select({ max: sql<number>`coalesce(max(${matches.round}), 0)::int` })
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), eq(matches.stage, "KNOCKOUT")));
  return r?.max ?? 0;
}

export async function decorateMatches(rows: Match[]): Promise<MatchView[]> {
  if (!rows.length) return [];
  const ps = await playersById(rows.flatMap((m) => [m.playerAId, m.playerBId]));
  const gids = [...new Set(rows.map((m) => m.groupId).filter(Boolean) as string[])];
  const gs = gids.length ? await db.select().from(groups).where(inArray(groups.id, gids)) : [];
  const gname = new Map(gs.map((g) => [g.id, g.name]));
  const totals = new Map<string, number>();
  for (const t of new Set(rows.filter((r) => r.stage !== "GROUP").map((r) => r.tournamentId))) totals.set(t, await knockoutRounds(t));
  return rows.map((m) => {
    const groupName = m.groupId ? (gname.get(m.groupId) ?? null) : null;
    let label = "";
    if (m.stage === "GROUP") label = `Grupa ${groupName ?? "?"} · kolejka ${m.groupRound}`;
    else if (m.stage === "THIRD_PLACE") label = "Mecz o 3. miejsce";
    else label = roundName(m.round ?? 1, totals.get(m.tournamentId) ?? 1);
    return {
      ...m,
      a: m.playerAId ? (ps.get(m.playerAId) ?? null) : null,
      b: m.playerBId ? (ps.get(m.playerBId) ?? null) : null,
      groupName,
      label,
    };
  });
}

// ---------------------------------------------------------------------------
// Publiczne
// ---------------------------------------------------------------------------

export async function getAnnouncements(tournamentId: string, limit = 10) {
  return db
    .select()
    .from(announcements)
    .where(and(eq(announcements.tournamentId, tournamentId), eq(announcements.published, true)))
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
    .limit(limit);
}

export async function countPlayers(tournamentId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(participants)
    .where(and(eq(participants.tournamentId, tournamentId), eq(participants.status, "ACTIVE")));
  return r?.n ?? 0;
}

export async function upcomingScheduled(tournamentId: string, limit = 6) {
  const rows = await db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        isNotNull(matches.scheduledAt),
        gte(matches.scheduledAt, new Date(Date.now() - 3 * 3_600_000)),
        inArray(matches.status, ["PENDING", "REPORTED", "DISPUTED"]),
      ),
    )
    .orderBy(asc(matches.scheduledAt))
    .limit(limit);
  return decorateMatches(rows);
}

export async function recentResults(tournamentId: string, limit = 6) {
  const rows = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), inArray(matches.status, ["CONFIRMED", "WALKOVER"]), isNotNull(matches.winnerId)))
    .orderBy(desc(matches.completedAt))
    .limit(limit);
  return decorateMatches(rows);
}

export async function listPlayers(tournamentId: string, search?: string) {
  const rows = await db
    .select({
      id: participants.id,
      nick: participants.nick,
      status: participants.status,
      avatarUrl: users.avatarUrl,
      youtubeUrl: participants.youtubeUrl,
      twitchUrl: participants.twitchUrl,
      kickUrl: participants.kickUrl,
      createdAt: participants.createdAt,
    })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .where(and(eq(participants.tournamentId, tournamentId), ne(participants.status, "WITHDRAWN"), search ? ilike(participants.nick, `%${search}%`) : sql`true`))
    .orderBy(asc(sql`lower(${participants.nick})`));
  const mem = await db
    .select({ pid: groupMembers.participantId, name: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groups.tournamentId, tournamentId));
  const gmap = new Map(mem.map((m) => [m.pid, m.name]));
  const stats = await db
    .select({ winner: matches.winnerId, a: matches.playerAId, b: matches.playerBId })
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), inArray(matches.status, ["CONFIRMED", "WALKOVER"]), isNotNull(matches.winnerId)));
  const wl = new Map<string, { w: number; l: number }>();
  for (const s of stats) {
    for (const p of [s.a, s.b]) {
      if (!p) continue;
      const e = wl.get(p) ?? { w: 0, l: 0 };
      if (s.winner === p) e.w++;
      else e.l++;
      wl.set(p, e);
    }
  }
  return rows.map((r) => ({ ...r, groupName: gmap.get(r.id) ?? null, wins: wl.get(r.id)?.w ?? 0, losses: wl.get(r.id)?.l ?? 0 }));
}

export async function getBracket(tournamentId: string) {
  const rows = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), inArray(matches.stage, ["KNOCKOUT", "THIRD_PLACE"])))
    .orderBy(asc(matches.round), asc(matches.position));
  const views = await decorateMatches(rows);
  const totalRounds = Math.max(0, ...views.filter((v) => v.stage === "KNOCKOUT").map((v) => v.round ?? 0));
  const rounds = Array.from({ length: totalRounds }, (_, i) => ({
    round: i + 1,
    name: roundName(i + 1, totalRounds),
    matches: views.filter((v) => v.stage === "KNOCKOUT" && v.round === i + 1),
  }));
  return { rounds, third: views.find((v) => v.stage === "THIRD_PLACE") ?? null };
}

export async function getParticipantByUser(tournamentId: string, userId: string) {
  const [p] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.tournamentId, tournamentId), eq(participants.userId, userId)));
  return p ?? null;
}

export async function getPlayerProfile(participantId: string) {
  const [row] = await db
    .select({ p: participants, avatarUrl: users.avatarUrl, discordUsername: users.discordUsername, discordGlobalName: users.discordGlobalName })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .where(eq(participants.id, participantId));
  if (!row) return null;
  const ms = await db
    .select()
    .from(matches)
    .where(or(eq(matches.playerAId, participantId), eq(matches.playerBId, participantId)))
    .orderBy(asc(matches.stage), asc(matches.round), asc(matches.groupRound));
  const views = await decorateMatches(ms);
  const played = views.filter((m) => isFinished(m.status) && m.winnerId).sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
  const upcoming = views
    .filter((m) => !isFinished(m.status) && m.playerAId && m.playerBId)
    .sort((a, b) => (a.scheduledAt?.getTime() ?? Infinity) - (b.scheduledAt?.getTime() ?? Infinity));

  // statystyki frakcji/bohaterów z zatwierdzonych raportów
  const games = await db
    .select({
      matchId: matchReports.matchId,
      winnerId: matchReportGames.winnerId,
      factionA: matchReportGames.factionA,
      factionB: matchReportGames.factionB,
      heroA: matchReportGames.heroA,
      heroB: matchReportGames.heroB,
      endDay: matchReportGames.endDay,
    })
    .from(matchReportGames)
    .innerJoin(matchReports, eq(matchReports.id, matchReportGames.reportId))
    .where(and(eq(matchReports.status, "ACCEPTED"), inArray(matchReports.matchId, ms.map((m) => m.id).concat(["00000000-0000-0000-0000-000000000000"]))));
  const sideById = new Map(ms.map((m) => [m.id, m.playerAId === participantId ? "A" : "B"]));
  const factions = new Map<string, { games: number; wins: number }>();
  const heroCount = new Map<string, number>();
  let gw = 0;
  let gl = 0;
  for (const g of games) {
    const side = sideById.get(g.matchId);
    const f = side === "A" ? g.factionA : g.factionB;
    const h = side === "A" ? g.heroA : g.heroB;
    const won = g.winnerId === participantId;
    if (won) gw++;
    else gl++;
    const e = factions.get(f) ?? { games: 0, wins: 0 };
    e.games++;
    if (won) e.wins++;
    factions.set(f, e);
    heroCount.set(h, (heroCount.get(h) ?? 0) + 1);
  }
  const heroRows = heroCount.size
    ? await db.select().from(heroes).where(inArray(heroes.slug, [...heroCount.keys()]))
    : [];

  // pozycja w grupie
  const [gm] = await db
    .select({ groupId: groupMembers.groupId, name: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.participantId, participantId));

  return {
    participant: row.p,
    avatarUrl: row.avatarUrl,
    discordName: row.discordGlobalName ?? row.discordUsername,
    played,
    upcoming,
    group: gm ?? null,
    stats: {
      wins: played.filter((m) => m.winnerId === participantId).length,
      losses: played.filter((m) => m.winnerId !== participantId).length,
      gamesWon: gw,
      gamesLost: gl,
      factions: [...factions.entries()].map(([slug, v]) => ({ slug, ...v })).sort((a, b) => b.games - a.games),
      heroes: [...heroCount.entries()]
        .map(([slug, count]) => ({ slug, count, hero: heroRows.find((h) => h.slug === slug) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    },
    knockout: views.filter((m) => m.stage !== "GROUP"),
  };
}

export async function getMatchDetail(matchId: string) {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!m) return null;
  const [view] = await decorateMatches([m]);
  const reps = await db
    .select({ r: matchReports, submittedBy: users.discordUsername, byGlobal: users.discordGlobalName })
    .from(matchReports)
    .innerJoin(users, eq(users.id, matchReports.submittedById))
    .where(eq(matchReports.matchId, matchId))
    .orderBy(desc(matchReports.createdAt));
  const games = reps.length
    ? await db
        .select({ g: matchReportGames, templateName: mapTemplates.name })
        .from(matchReportGames)
        .leftJoin(mapTemplates, eq(mapTemplates.id, matchReportGames.mapTemplateId))
        .where(inArray(matchReportGames.reportId, reps.map((r) => r.r.id)))
        .orderBy(asc(matchReportGames.gameNo))
    : [];
  const ds = await db
    .select({ d: disputes, openedBy: users.discordUsername })
    .from(disputes)
    .innerJoin(users, eq(users.id, disputes.openedById))
    .where(eq(disputes.matchId, matchId))
    .orderBy(desc(disputes.createdAt));
  const revs = await db
    .select({ r: matchRevisions, editor: users.discordUsername })
    .from(matchRevisions)
    .leftJoin(users, eq(users.id, matchRevisions.editedById))
    .where(eq(matchRevisions.matchId, matchId))
    .orderBy(desc(matchRevisions.createdAt));
  const proposals = await db
    .select()
    .from(slotProposals)
    .where(and(eq(slotProposals.matchId, matchId), gte(slotProposals.endsAt, new Date())))
    .orderBy(asc(slotProposals.startsAt));
  const pids = [m.playerAId, m.playerBId].filter(Boolean) as string[];
  const userIds = pids.length
    ? await db.select({ id: participants.id, userId: participants.userId }).from(participants).where(inArray(participants.id, pids))
    : [];
  return {
    match: view,
    userA: userIds.find((u) => u.id === m.playerAId)?.userId ?? null,
    userB: userIds.find((u) => u.id === m.playerBId)?.userId ?? null,
    reports: reps.map((r) => ({
      ...r.r,
      submittedBy: r.byGlobal ?? r.submittedBy,
      games: games.filter((g) => g.g.reportId === r.r.id).map((g) => ({ ...g.g, templateName: g.templateName })),
    })),
    disputes: ds.map((d) => ({ ...d.d, openedBy: d.openedBy })),
    revisions: revs.map((r) => ({ ...r.r, editor: r.editor })),
    proposals,
  };
}

// ---------------------------------------------------------------------------
// Konto
// ---------------------------------------------------------------------------

export async function getMyMatches(participantId: string) {
  const rows = await db
    .select()
    .from(matches)
    .where(or(eq(matches.playerAId, participantId), eq(matches.playerBId, participantId)));
  const views = await decorateMatches(rows);
  return {
    open: views
      .filter((m) => ["PENDING", "REPORTED", "DISPUTED"].includes(m.status) && m.playerAId && m.playerBId)
      .sort((a, b) => (a.scheduledAt?.getTime() ?? Infinity) - (b.scheduledAt?.getTime() ?? Infinity)),
    waiting: views.filter((m) => m.status === "WAITING"),
    done: views.filter((m) => isFinished(m.status)).sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)),
  };
}

export async function getNotifications(userId: string, limit = 30) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function unreadCount(userId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), sql`${notifications.readAt} is null`));
  return r?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export async function adminDashboard(tournamentId: string) {
  const [counts] = await db
    .select({
      players: sql<number>`(select count(*)::int from participants where tournament_id = ${tournamentId} and status = 'ACTIVE')`,
      users: sql<number>`(select count(*)::int from users)`,
      open: sql<number>`(select count(*)::int from matches where tournament_id = ${tournamentId} and status in ('PENDING','REPORTED'))`,
      disputed: sql<number>`(select count(*)::int from matches where tournament_id = ${tournamentId} and status = 'DISPUTED')`,
      reported: sql<number>`(select count(*)::int from matches where tournament_id = ${tournamentId} and status = 'REPORTED')`,
      done: sql<number>`(select count(*)::int from matches where tournament_id = ${tournamentId} and status in ('CONFIRMED','WALKOVER'))`,
      total: sql<number>`(select count(*)::int from matches where tournament_id = ${tournamentId})`,
      outboxPending: sql<number>`(select count(*)::int from discord_outbox where sent_at is null and failed_at is null)`,
      outboxFailed: sql<number>`(select count(*)::int from discord_outbox where failed_at is not null and created_at > now() - interval '7 days')`,
    })
    .from(sql`(select 1) as x`);
  return counts;
}

export type ReportFilter = "disputed" | "reported" | "open" | "done" | "all";

export async function listMatchesForStaff(tournamentId: string, filter: ReportFilter, search?: string) {
  const statusFor: Record<ReportFilter, Match["status"][] | null> = {
    disputed: ["DISPUTED"],
    reported: ["REPORTED"],
    open: ["PENDING", "REPORTED", "DISPUTED"],
    done: ["CONFIRMED", "WALKOVER"],
    all: null,
  };
  const st = statusFor[filter];
  const rows = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), st ? inArray(matches.status, st) : sql`true`, ne(matches.status, "WAITING")))
    .orderBy(asc(matches.stage), asc(matches.round), asc(matches.groupRound))
    .limit(500);
  let views = await decorateMatches(rows);
  if (search) {
    const s = search.toLowerCase();
    views = views.filter((v) => v.a?.nick.toLowerCase().includes(s) || v.b?.nick.toLowerCase().includes(s));
  }
  return views;
}

export async function listUsers(tournamentId: string, search?: string) {
  return db
    .select({
      id: users.id,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordGlobalName: users.discordGlobalName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      banned: users.banned,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      participantId: participants.id,
      nick: participants.nick,
      participantStatus: participants.status,
    })
    .from(users)
    .leftJoin(participants, and(eq(participants.userId, users.id), eq(participants.tournamentId, tournamentId)))
    .where(
      search
        ? or(ilike(users.discordUsername, `%${search}%`), ilike(participants.nick, `%${search}%`), eq(users.discordId, search))
        : sql`true`,
    )
    .orderBy(desc(users.createdAt))
    .limit(300);
}

export async function auditLog(limit = 200) {
  return db
    .select({ l: adminAuditLog, actor: users.discordUsername })
    .from(adminAuditLog)
    .leftJoin(users, eq(users.id, adminAuditLog.actorId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}

export async function scheduleList(tournamentId: string) {
  const rows = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), inArray(matches.status, ["PENDING", "REPORTED", "DISPUTED"])))
    .orderBy(asc(matches.scheduledAt));
  const views = await decorateMatches(rows);
  const props = rows.length
    ? await db
        .select()
        .from(slotProposals)
        .where(and(inArray(slotProposals.matchId, rows.map((r) => r.id)), gte(slotProposals.endsAt, new Date())))
        .orderBy(asc(slotProposals.startsAt))
    : [];
  return views.map((v) => ({ ...v, proposal: props.find((p) => p.matchId === v.id) ?? null }));
}

export async function outboxRecent(limit = 50) {
  return db.select().from(discordOutbox).orderBy(desc(discordOutbox.createdAt)).limit(limit);
}
