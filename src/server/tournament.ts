import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  groupMembers,
  groups,
  matches,
  participants,
  sessions,
  tournaments,
  users,
  type Phase,
  type Role,
  type Tournament,
} from "@/db/schema";
import { getTournament } from "@/lib/tournament/current";
import { drawGroups, groupName, proposeGroupVariants, roundRobin, type GroupVariant } from "@/lib/tournament/groups";
import { computeStandings } from "@/lib/tournament/standings";
import { planBracket, roundName } from "@/lib/tournament/bracket";
import { logAction } from "@/lib/audit";
import { publish } from "@/lib/realtime";
import { notifyUsers, queueChannelMessage } from "@/lib/notify";
import { decrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { addGuildMember, createInvite, isGuildMember } from "@/lib/discord/api";
import { PHASE_LABELS } from "@/lib/labels";
import type { SessionUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/authz";
import { ServiceError } from "./errors";
import { applyResult, isFinished } from "./matches";

function assertAdmin(user: SessionUser) {
  if (!hasRole(user, "ADMIN")) throw new ServiceError("Ta operacja wymaga roli Administratora.");
}

// ---------------------------------------------------------------------------
// Zapisy
// ---------------------------------------------------------------------------

export const NICK_RE = /^[\p{L}\p{N}_.\- ]{2,24}$/u;

export type RegisterResult = { status: "registered" } | { status: "needs_discord"; inviteUrl: string | null };

async function ensureGuildMembership(user: SessionUser): Promise<RegisterResult | null> {
  const e = env();
  if (!e.discordBotConfigured || !/^\d+$/.test(user.discordId)) return null; // brak bota lub konto testowe
  if (await isGuildMember(user.discordId)) return null;
  const [row] = await db
    .select({ token: users.discordAccessToken, exp: users.discordTokenExpiresAt })
    .from(users)
    .where(eq(users.id, user.id));
  const token = row?.token && row.exp && row.exp > new Date() ? decrypt(row.token) : null;
  if (token) {
    try {
      await addGuildMember(user.discordId, token);
      return null;
    } catch (err) {
      console.warn("[register] auto-join failed", err);
    }
  }
  let inviteUrl: string | null = e.DISCORD_INVITE_URL || null;
  if (!inviteUrl) inviteUrl = await createInvite().catch(() => null);
  return { status: "needs_discord", inviteUrl };
}

export async function register(user: SessionUser, input: { nick: string; acceptRules: boolean; acceptPrivacy: boolean }): Promise<RegisterResult> {
  const t = await getTournament();
  if (t.phase !== "REGISTRATION_OPEN") throw new ServiceError("Zapisy są obecnie zamknięte.");
  const nick = input.nick.trim().replace(/\s+/g, " ");
  if (!NICK_RE.test(nick)) throw new ServiceError("Nick musi mieć 2–24 znaki (litery, cyfry, spacja, _ . -).");
  if (!input.acceptRules) throw new ServiceError("Musisz zaakceptować regulamin.");
  if (!input.acceptPrivacy) throw new ServiceError("Musisz zaakceptować politykę prywatności.");

  const [existing] = await db
    .select()
    .from(participants)
    .where(and(eq(participants.tournamentId, t.id), eq(participants.userId, user.id)));
  if (existing?.status === "ACTIVE") throw new ServiceError("Jesteś już zapisany(-a) do turnieju.");
  if (existing?.status === "BANNED") throw new ServiceError("Twoje konto zostało wykluczone z turnieju.");

  const membership = await ensureGuildMembership(user);
  if (membership) return membership;

  const [taken] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.tournamentId, t.id), sql`lower(${participants.nick}) = lower(${nick})`, existing ? ne(participants.id, existing.id) : sql`true`));
  if (taken) throw new ServiceError("Ten nick jest już zajęty.");

  const now = new Date();
  const values = {
    nick,
    status: "ACTIVE" as const,
    rulesAcceptedAt: now,
    rulesVersion: t.rulesVersion,
    privacyAcceptedAt: now,
    privacyVersion: t.privacyVersion,
  };
  if (existing) await db.update(participants).set(values).where(eq(participants.id, existing.id));
  else await db.insert(participants).values({ ...values, tournamentId: t.id, userId: user.id });
  await publish(["players"]);
  return { status: "registered" };
}

export async function withdraw(user: SessionUser) {
  const t = await getTournament();
  if (t.phase !== "REGISTRATION_OPEN") throw new ServiceError("Wypisać się można tylko w trakcie zapisów. Skontaktuj się z organizatorem.");
  await db
    .update(participants)
    .set({ status: "WITHDRAWN" })
    .where(and(eq(participants.tournamentId, t.id), eq(participants.userId, user.id), eq(participants.status, "ACTIVE")));
  await publish(["players"]);
}

const URL_RULES = {
  youtubeUrl: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  twitchUrl: ["twitch.tv", "www.twitch.tv"],
  kickUrl: ["kick.com", "www.kick.com"],
} as const;

export async function updateProfile(user: SessionUser, input: { nick?: string; youtubeUrl?: string; twitchUrl?: string; kickUrl?: string; bio?: string }) {
  const t = await getTournament();
  const [p] = await db.select().from(participants).where(and(eq(participants.tournamentId, t.id), eq(participants.userId, user.id)));
  if (!p) throw new ServiceError("Najpierw zapisz się do turnieju.");
  const patch: Record<string, string | null> = {};
  for (const key of Object.keys(URL_RULES) as (keyof typeof URL_RULES)[]) {
    const v = input[key]?.trim();
    if (!v) {
      patch[key] = null;
      continue;
    }
    let u: URL;
    try {
      u = new URL(v);
    } catch {
      throw new ServiceError("Nieprawidłowy adres URL kanału.");
    }
    if (u.protocol !== "https:" || !(URL_RULES[key] as readonly string[]).includes(u.hostname.toLowerCase())) {
      throw new ServiceError(`Link musi prowadzić do ${URL_RULES[key][0]} (https).`);
    }
    patch[key] = u.toString();
  }
  patch.bio = input.bio?.trim().slice(0, 300) || null;
  if (input.nick !== undefined && input.nick.trim() !== p.nick) {
    if (t.phase !== "REGISTRATION_OPEN" && t.phase !== "DRAFT") throw new ServiceError("Nick można zmienić tylko w trakcie zapisów.");
    const nick = input.nick.trim().replace(/\s+/g, " ");
    if (!NICK_RE.test(nick)) throw new ServiceError("Nick musi mieć 2–24 znaki (litery, cyfry, spacja, _ . -).");
    const [taken] = await db
      .select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.tournamentId, t.id), sql`lower(${participants.nick}) = lower(${nick})`, ne(participants.id, p.id)));
    if (taken) throw new ServiceError("Ten nick jest już zajęty.");
    patch.nick = nick;
  }
  await db.update(participants).set(patch).where(eq(participants.id, p.id));
  await publish(["players"]);
}

// ---------------------------------------------------------------------------
// Fazy turnieju
// ---------------------------------------------------------------------------

const MANUAL_TRANSITIONS: Partial<Record<Phase, Phase[]>> = {
  DRAFT: ["REGISTRATION_OPEN"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "DRAFT"],
  REGISTRATION_CLOSED: ["REGISTRATION_OPEN"],
  KNOCKOUT: ["FINISHED"],
  FINISHED: ["KNOCKOUT"],
};

export async function setPhase(admin: SessionUser, to: Phase) {
  assertAdmin(admin);
  const t = await getTournament();
  if (!MANUAL_TRANSITIONS[t.phase]?.includes(to)) {
    throw new ServiceError(`Nie można przejść z fazy „${PHASE_LABELS[t.phase]}” do „${PHASE_LABELS[to]}”.`);
  }
  await db.transaction(async (tx) => {
    await tx.update(tournaments).set({ phase: to }).where(eq(tournaments.id, t.id));
    await logAction(admin.id, "PHASE_CHANGE", { entityType: "tournament", entityId: t.id, payload: { from: t.phase, to } }, tx);
    await publish(["content", "players"], tx);
  });
}

// ---------------------------------------------------------------------------
// Grupy
// ---------------------------------------------------------------------------

async function activeParticipants(tournamentId: string) {
  return db
    .select({ id: participants.id, userId: participants.userId })
    .from(participants)
    .where(and(eq(participants.tournamentId, tournamentId), eq(participants.status, "ACTIVE")))
    .orderBy(asc(participants.createdAt));
}

export async function groupVariants(): Promise<{ players: number; variants: GroupVariant[] }> {
  const t = await getTournament();
  const ps = await activeParticipants(t.id);
  return { players: ps.length, variants: proposeGroupVariants(ps.length) };
}

export async function drawTournamentGroups(admin: SessionUser, groupCount: number) {
  assertAdmin(admin);
  const t = await getTournament();
  if (t.phase !== "REGISTRATION_CLOSED") throw new ServiceError("Losowanie grup jest możliwe po zamknięciu zapisów.");
  const ps = await activeParticipants(t.id);
  const variant = proposeGroupVariants(ps.length).find((v) => v.groupCount === groupCount);
  if (!variant) throw new ServiceError("Wybrany wariant grup jest niedostępny dla aktualnej liczby graczy.");

  const drawn = drawGroups(ps, variant.sizes);
  await db.transaction(async (tx) => {
    const [existingGroup] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.tournamentId, t.id)).limit(1);
    if (existingGroup) throw new ServiceError("Grupy zostały już wylosowane.");
    for (let gi = 0; gi < drawn.length; gi++) {
      const [g] = await tx.insert(groups).values({ tournamentId: t.id, name: groupName(gi), sortOrder: gi }).returning();
      const members = drawn[gi];
      await tx.insert(groupMembers).values(members.map((p, seat) => ({ groupId: g.id, participantId: p.id, seat })));
      const rounds = roundRobin(members.length);
      const rows = rounds.flatMap((pairs, ri) =>
        pairs.map(([a, b]) => ({
          tournamentId: t.id,
          stage: "GROUP" as const,
          groupId: g.id,
          groupRound: ri + 1,
          playerAId: members[a].id,
          playerBId: members[b].id,
          bestOf: t.groupBestOf,
          status: "PENDING" as const,
        })),
      );
      if (rows.length) await tx.insert(matches).values(rows);
    }
    await tx.update(tournaments).set({ phase: "GROUPS", currentRoundLabel: "Faza grupowa" }).where(eq(tournaments.id, t.id));
    await logAction(admin.id, "GROUPS_DRAWN", {
      entityType: "tournament",
      entityId: t.id,
      payload: { players: ps.length, groupCount, sizes: variant.sizes },
    }, tx);
    await notifyUsers(ps.map((p) => p.userId), {
      type: "GROUPS_DRAWN",
      title: "Grupy zostały wylosowane!",
      body: "Sprawdź swoją grupę i przeciwników. Umówcie terminy meczów.",
      href: "/konto",
      discord: false,
    }, tx);
    await publish(["groups", "matches", "players", "content"], tx);
  });
}

export async function resetGroups(admin: SessionUser) {
  assertAdmin(admin);
  const t = await getTournament();
  if (t.phase !== "GROUPS") throw new ServiceError("Grupy można usunąć tylko w fazie grupowej.");
  await db.transaction(async (tx) => {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(matches)
      .where(and(eq(matches.tournamentId, t.id), inArray(matches.status, ["CONFIRMED", "REPORTED", "DISPUTED"])));
    await tx.delete(matches).where(eq(matches.tournamentId, t.id));
    await tx.delete(groups).where(eq(groups.tournamentId, t.id));
    await tx.update(tournaments).set({ phase: "REGISTRATION_CLOSED", currentRoundLabel: null }).where(eq(tournaments.id, t.id));
    await logAction(admin.id, "GROUPS_RESET", { entityType: "tournament", entityId: t.id, payload: { deletedPlayedMatches: n } }, tx);
    await publish(["groups", "matches", "players"], tx);
  });
}

export async function loadGroupStandings(tournamentId: string) {
  const gs = await db.select().from(groups).where(eq(groups.tournamentId, tournamentId)).orderBy(asc(groups.sortOrder));
  if (!gs.length) return [];
  const mem = await db.select().from(groupMembers).where(inArray(groupMembers.groupId, gs.map((g) => g.id)));
  const ms = await db.select().from(matches).where(and(eq(matches.tournamentId, tournamentId), eq(matches.stage, "GROUP")));
  return gs.map((g) => {
    const ids = mem.filter((m) => m.groupId === g.id).sort((a, b) => a.seat - b.seat).map((m) => m.participantId);
    const gm = ms.filter((m) => m.groupId === g.id);
    const standings = computeStandings(
      ids,
      gm.map((m) => ({ ...m, finished: isFinished(m.status) })),
      g.manualOrder,
    );
    return { group: g, standings, matches: gm, complete: gm.every((m) => isFinished(m.status)) };
  });
}

export async function setGroupTiebreak(admin: SessionUser, groupId: string, order: string[]) {
  assertAdmin(admin);
  await db.transaction(async (tx) => {
    const mem = await tx.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
    const ids = new Set(mem.map((m) => m.participantId));
    if (order.length !== ids.size || !order.every((o) => ids.has(o))) throw new ServiceError("Nieprawidłowa kolejność.");
    await tx.update(groups).set({ manualOrder: order }).where(eq(groups.id, groupId));
    await logAction(admin.id, "GROUP_TIEBREAK", { entityType: "group", entityId: groupId, payload: { order } }, tx);
    await publish(["groups"], tx);
  });
}

// ---------------------------------------------------------------------------
// Drabinka
// ---------------------------------------------------------------------------

export async function generateBracket(admin: SessionUser, force = false) {
  assertAdmin(admin);
  const t = await getTournament();
  if (t.phase !== "GROUPS") throw new ServiceError("Drabinkę można wygenerować po fazie grupowej.");
  const data = await loadGroupStandings(t.id);
  if (!data.length) throw new ServiceError("Brak grup.");
  const incomplete = data.filter((d) => !d.complete);
  if (incomplete.length && !force) {
    throw new ServiceError(`Nie wszystkie mecze grupowe są zakończone (grupy: ${incomplete.map((d) => d.group.name).join(", ")}).`);
  }
  for (const d of data) {
    // remis wpływający na awans (miejsca 1–3)
    const critical = d.standings.slice(0, 3).filter((r) => r.tied);
    if (critical.length && d.standings.length > 2) {
      throw new ServiceError(`Grupa ${d.group.name}: nierozstrzygnięty remis wpływający na awans – ustal kolejność ręcznie.`);
    }
  }
  const qualifiers = data.map((d) => [d.standings[0].participantId, d.standings[1].participantId] as [string, string]);
  const plan = planBracket(qualifiers, { knockout: t.knockoutBestOf, final: t.finalBestOf, thirdPlace: t.thirdPlaceBestOf });
  const ids = new Map(plan.map((p) => [p.key, randomUUID()]));

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.tournamentId, t.id), ne(matches.stage, "GROUP")))
      .limit(1);
    if (existing) throw new ServiceError("Drabinka już istnieje.");
    if (force) {
      // niezakończone mecze grupowe przestają mieć znaczenie
      await tx
        .update(matches)
        .set({ status: "WALKOVER" })
        .where(and(eq(matches.tournamentId, t.id), eq(matches.stage, "GROUP"), inArray(matches.status, ["PENDING", "REPORTED", "DISPUTED"])));
    }
    await tx.insert(matches).values(
      plan.map((p) => ({
        id: ids.get(p.key)!,
        tournamentId: t.id,
        stage: p.stage,
        round: p.round,
        position: p.position,
        playerAId: p.playerA,
        playerBId: p.playerB,
        bestOf: p.bestOf,
        status: p.playerA && p.playerB ? ("PENDING" as const) : ("WAITING" as const),
        nextMatchId: p.next ? ids.get(p.next.key)! : null,
        nextSlot: p.next?.slot ?? null,
        loserNextMatchId: p.loserNext ? ids.get(p.loserNext.key)! : null,
        loserNextSlot: p.loserNext?.slot ?? null,
      })),
    );
    const totalRounds = Math.max(...plan.map((p) => p.round));
    await tx
      .update(tournaments)
      .set({ phase: "KNOCKOUT", currentRoundLabel: roundName(1, totalRounds) })
      .where(eq(tournaments.id, t.id));
    await logAction(admin.id, "BRACKET_GENERATED", { entityType: "tournament", entityId: t.id, payload: { qualifiers, force } }, tx);

    const qIds = qualifiers.flat();
    const qUsers = await tx.select({ userId: participants.userId }).from(participants).where(inArray(participants.id, qIds));
    await notifyUsers(qUsers.map((q) => q.userId), {
      type: "BRACKET",
      title: "Awans do fazy pucharowej!",
      body: "Drabinka została wygenerowana – sprawdź swojego przeciwnika.",
      href: "/drabinka",
      discord: false,
    }, tx);
    // walkowery dla graczy nieaktywnych w 1. rundzie
    const firstRound = await tx.select().from(matches).where(and(eq(matches.tournamentId, t.id), eq(matches.stage, "KNOCKOUT"), eq(matches.round, 1)));
    const statuses = await tx.select({ id: participants.id, status: participants.status }).from(participants).where(inArray(participants.id, qIds));
    const inactive = new Set(statuses.filter((s) => s.status !== "ACTIVE").map((s) => s.id));
    for (const m of firstRound) {
      const a = inactive.has(m.playerAId!);
      const b = inactive.has(m.playerBId!);
      if (a !== b) await applyResult(tx, m, { winnerId: a ? m.playerBId! : m.playerAId!, walkover: true });
    }
    await publish(["bracket", "matches", "players", "content"], tx);
  });
}

// ---------------------------------------------------------------------------
// Powiadomienie o rundzie (Discord)
// ---------------------------------------------------------------------------

export async function pingCurrentRound(admin: SessionUser, customLabel?: string) {
  assertAdmin(admin);
  const t = await getTournament();
  if (!env().DISCORD_CHANNEL_ID) throw new ServiceError("Nie skonfigurowano kanału Discord (DISCORD_CHANNEL_ID).");
  const open = await db
    .select({ id: matches.id, a: matches.playerAId, b: matches.playerBId, stage: matches.stage, round: matches.round, scheduledAt: matches.scheduledAt })
    .from(matches)
    .where(and(eq(matches.tournamentId, t.id), inArray(matches.status, ["PENDING", "REPORTED"])));
  if (!open.length) throw new ServiceError("Brak meczów do rozegrania.");
  const pids = [...new Set(open.flatMap((m) => [m.a!, m.b!]))];
  const rows = await db
    .select({ id: participants.id, discordId: users.discordId, nick: participants.nick })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .where(inArray(participants.id, pids));
  const by = new Map(rows.map((r) => [r.id, r]));
  const tag = (pid: string | null) => {
    const r = pid ? by.get(pid) : undefined;
    if (!r) return "?";
    return /^\d+$/.test(r.discordId) ? `<@${r.discordId}>` : r.nick;
  };
  const label = customLabel?.trim() || t.currentRoundLabel || PHASE_LABELS[t.phase];
  const lines = [
    `⚔️ **${t.name} – ${label}**`,
    `Poniżsi gracze mają mecze do rozegrania. Umówcie termin i zgłoście wynik: ${env().APP_URL}/konto`,
    "",
    ...open.map((m) => `• ${tag(m.a)} vs ${tag(m.b)} – ${env().APP_URL}/mecze/${m.id}`),
  ];
  const parts = await queueChannelMessage(lines.join("\n"));
  await logAction(admin.id, "ROUND_PING", { entityType: "tournament", entityId: t.id, payload: { matches: open.length, label, parts } });
  return { matches: open.length, parts };
}

// ---------------------------------------------------------------------------
// Użytkownicy i role
// ---------------------------------------------------------------------------

export async function setUserRole(admin: SessionUser, userId: string, role: Role) {
  assertAdmin(admin);
  await db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!u) throw new ServiceError("Użytkownik nie istnieje.");
    if (u.role === role) return;
    if (u.role === "ADMIN" && role !== "ADMIN") {
      const [{ n }] = await tx.select({ n: count() }).from(users).where(and(eq(users.role, "ADMIN"), eq(users.banned, false)));
      if (n <= 1) throw new ServiceError("Nie można odebrać roli ostatniemu administratorowi.");
    }
    await tx.update(users).set({ role }).where(eq(users.id, userId));
    await logAction(admin.id, "ROLE_CHANGE", { entityType: "user", entityId: userId, payload: { from: u.role, to: role, user: u.discordUsername } }, tx);
  });
}

/** Wyklucza gracza z turnieju; niezakończone mecze kończą się walkowerem dla przeciwnika. */
async function removeParticipantTx(admin: SessionUser, participantId: string, status: "WITHDRAWN" | "BANNED", reason: string) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(participants).where(eq(participants.id, participantId)).for("update");
    if (!p) throw new ServiceError("Gracz nie istnieje.");
    await tx.update(participants).set({ status }).where(eq(participants.id, p.id));
    const open = await tx
      .select()
      .from(matches)
      .where(and(or(eq(matches.playerAId, p.id), eq(matches.playerBId, p.id)), inArray(matches.status, ["PENDING", "REPORTED", "DISPUTED"])));
    for (const m of open) {
      const winner = m.playerAId === p.id ? m.playerBId : m.playerAId;
      if (winner) await applyResult(tx, m, { winnerId: winner, walkover: true });
    }
    await logAction(admin.id, "PARTICIPANT_REMOVED", { entityType: "participant", entityId: p.id, payload: { nick: p.nick, status, reason, walkovers: open.length } }, tx);
    await publish(["players", "groups", "bracket", "matches"], tx);
  });
}

export async function removeParticipant(staff: SessionUser, participantId: string, reason: string) {
  assertAdmin(staff);
  await removeParticipantTx(staff, participantId, "WITHDRAWN", reason);
}

export async function restoreParticipant(admin: SessionUser, participantId: string) {
  assertAdmin(admin);
  await db.update(participants).set({ status: "ACTIVE" }).where(eq(participants.id, participantId));
  await logAction(admin.id, "PARTICIPANT_RESTORED", { entityType: "participant", entityId: participantId });
  await publish(["players"]);
}

export async function setUserBan(admin: SessionUser, userId: string, banned: boolean, reason: string) {
  assertAdmin(admin);
  if (userId === admin.id) throw new ServiceError("Nie możesz zbanować samego siebie.");
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new ServiceError("Użytkownik nie istnieje.");
  if (banned && u.role === "ADMIN") throw new ServiceError("Najpierw odbierz rolę administratora.");
  await db.update(users).set({ banned }).where(eq(users.id, userId));
  if (banned) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    const t = await getTournament();
    const [p] = await db.select().from(participants).where(and(eq(participants.tournamentId, t.id), eq(participants.userId, userId)));
    if (p && p.status === "ACTIVE") await removeParticipantTx(admin, p.id, "BANNED", reason);
    else if (p) await db.update(participants).set({ status: "BANNED" }).where(eq(participants.id, p.id));
  }
  await logAction(admin.id, banned ? "USER_BAN" : "USER_UNBAN", { entityType: "user", entityId: userId, payload: { user: u.discordUsername, reason } });
}

// ---------------------------------------------------------------------------
// Konfiguracja
// ---------------------------------------------------------------------------

export type ConfigInput = Partial<
  Pick<
    Tournament,
    | "name"
    | "tagline"
    | "bannerUrl"
    | "infoMd"
    | "rulesMd"
    | "privacyMd"
    | "prizesMd"
    | "scheduleMd"
    | "formatMd"
    | "gameSettings"
    | "groupBestOf"
    | "knockoutBestOf"
    | "finalBestOf"
    | "thirdPlaceBestOf"
    | "minSlotMinutes"
    | "currentRoundLabel"
  >
>;

export async function updateConfig(admin: SessionUser, input: ConfigInput) {
  assertAdmin(admin);
  const t = await getTournament();
  for (const k of ["groupBestOf", "knockoutBestOf", "finalBestOf", "thirdPlaceBestOf"] as const) {
    const v = input[k];
    if (v !== undefined && ![1, 3, 5, 7].includes(v)) throw new ServiceError("Format meczu musi być Bo1, Bo3, Bo5 lub Bo7.");
  }
  if (input.minSlotMinutes !== undefined && (input.minSlotMinutes < 30 || input.minSlotMinutes > 600 || input.minSlotMinutes % 30)) {
    throw new ServiceError("Minimalna długość terminu: 30–600 minut, co 30.");
  }
  const patch: Partial<Tournament> = { ...input };
  if (input.rulesMd !== undefined && input.rulesMd !== t.rulesMd) patch.rulesVersion = t.rulesVersion + 1;
  if (input.privacyMd !== undefined && input.privacyMd !== t.privacyMd) patch.privacyVersion = t.privacyVersion + 1;
  await db.transaction(async (tx) => {
    await tx.update(tournaments).set(patch).where(eq(tournaments.id, t.id));
    const changed = Object.keys(input).filter((k) => JSON.stringify((t as Record<string, unknown>)[k]) !== JSON.stringify((input as Record<string, unknown>)[k]));
    await logAction(admin.id, Object.keys(input).some((k) => k.endsWith("Md")) ? "CONTENT_UPDATE" : "CONFIG_UPDATE", {
      entityType: "tournament",
      entityId: t.id,
      payload: { changed },
    }, tx);
    await publish(["content"], tx);
  });
}
