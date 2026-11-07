import "server-only";
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLog, announcements, availabilitySlots, groups, matches, participants, tournaments, users, type Match } from "@/db/schema";
import { getHeroes, getTemplates, getTournament } from "@/lib/tournament/current";
import { logAction } from "@/lib/audit";
import { publish } from "@/lib/realtime";
import { env } from "@/lib/env";
import { hasRole } from "@/lib/authz";
import type { SessionUser } from "@/lib/auth/session";
import { ServiceError } from "./errors";
import * as T from "./tournament";
import * as M from "./matches";
import { PLAYER_COLOR_SLUGS, oppositeColor } from "@/data/colors";
import { indexToMwd, MAX_END_DAY_INDEX } from "@/lib/mwd";
import { scanAllProposals } from "./scheduling";

/**
 * Dane demonstracyjne: gracze testowi, wylosowane grupy, część rozegranych meczów (raporty, akceptacje, jeden spór)
 * i opcjonalnie drabinka. Używane przez `npm run db:seed` i przycisk w panelu (tylko przy ALLOW_DEMO_DATA=true).
 * Konta demo mają Discord ID „dev-demoN” – nie dostają wiadomości na Discordzie i da się je potem usunąć.
 */

const DEMO_PREFIX = "dev-demo";
const DEMO_ANNOUNCEMENT = "Witajcie w turnieju! (dane demo)";

const NICKS = [
  "Smoczy_Lord", "Gelu_Fan", "Nekromanta", "Krasnolud", "Archanioł", "Behemot", "Feniks", "Hydra",
  "Tytan", "Czarny_Smok", "Minotaur", "Gryf", "Ifryt", "Licz", "Wampir", "Cyklop",
  "Mantikora", "Naga", "Diabeł", "Rycerz_Mroku", "Pegaz", "Jednorożec", "Golem", "Bazyliszek",
  "Wywerna", "Kraken", "Meduza", "Troglodyta", "Harpia", "Ogr", "Ent", "Elf",
];

export const DEMO_MAX_PLAYERS = NICKS.length * 4;

function assertAdmin(user: SessionUser) {
  if (!hasRole(user, "ADMIN")) throw new ServiceError("Ta operacja wymaga roli Administratora.");
}

export async function seedDemo(admin: SessionUser, opts: { players: number; bracket: boolean }): Promise<string> {
  assertAdmin(admin);
  const count = Math.max(4, Math.min(DEMO_MAX_PLAYERS, Math.floor(opts.players)));
  const rnd = (n: number) => Math.floor(Math.random() * n);

  let t = await getTournament();
  if (t.phase !== "DRAFT" && t.phase !== "REGISTRATION_OPEN") {
    throw new ServiceError("Dane demo można wczytać tylko w fazie przygotowań lub otwartych zapisów. Najpierw wyczyść dane demo.");
  }
  if (t.phase === "DRAFT") await T.setPhase(admin, "REGISTRATION_OPEN");

  const players: (typeof users.$inferSelect)[] = [];
  for (let i = 0; i < count; i++) {
    const nick = i < NICKS.length ? NICKS[i] : `${NICKS[i % NICKS.length]}_${Math.floor(i / NICKS.length)}`;
    const name = `demo${i}`;
    const [u] = await db
      .insert(users)
      .values({ discordId: `dev-${name}`, discordUsername: name, discordGlobalName: nick })
      .onConflictDoUpdate({ target: users.discordId, set: { discordGlobalName: nick } })
      .returning();
    players.push(u);
    try {
      await T.register(u, { nick, acceptRules: true, acceptPrivacy: true });
    } catch {
      // już zapisany albo nick zajęty przez prawdziwe konto
    }
  }

  await T.setPhase(admin, "REGISTRATION_CLOSED");
  const { players: registered, variants } = await T.groupVariants();
  const variant = variants.find((v) => !v.outOfRange) ?? variants[0];
  if (!variant) throw new ServiceError("Za mało graczy do losowania grup.");
  await T.drawTournamentGroups(admin, variant.groupCount);

  const heroes = await getHeroes(true);
  t = await getTournament();
  const templates = await getTemplates(t.id, true);
  const factions = [...new Set(heroes.map((h) => h.faction))];
  const pick = <X,>(a: X[]) => a[rnd(a.length)];

  const randomReport = (bestOf: number, winner: "A" | "B") => {
    const need = Math.ceil(bestOf / 2);
    const loserWins = rnd(need);
    const seq: ("A" | "B")[] = [];
    let w = 0;
    let l = 0;
    while (w < need) {
      if (l < loserWins && (rnd(2) === 0 || w === need - 1)) {
        seq.push(winner === "A" ? "B" : "A");
        l++;
      } else {
        seq.push(winner);
        w++;
      }
    }
    return {
      games: seq.map((s) => {
        const colorA = pick([...PLAYER_COLOR_SLUGS]);
        const colorB = oppositeColor(colorA);
        const fa = pick(factions);
        const fb = pick(factions);
        return {
          winner: s,
          colorA,
          colorB,
          mapTemplateId: pick(templates).id,
          factionA: fa,
          factionB: fb,
          // czasem bohater spoza frakcji startowej (np. z tawerny)
          heroA: pick(rnd(5) ? heroes.filter((h) => h.faction === fa) : heroes).slug,
          heroB: pick(rnd(5) ? heroes.filter((h) => h.faction === fb) : heroes).slug,
          day: indexToMwd(1 + rnd(MAX_END_DAY_INDEX)),
          notes: rnd(4) === 0 ? "Decydująca bitwa na neutralnych smokach." : "",
        };
      }),
      summary: rnd(3) === 0 ? "Wyrównany mecz, rozstrzygnięty w ostatniej bitwie." : "",
    };
  };

  const userOf = async (participantId: string) => {
    const [p] = await db.select().from(participants).where(eq(participants.id, participantId));
    return players.find((u) => u.id === p?.userId);
  };

  let played = 0;
  const play = async (m: Match, mode: "accept" | "report" | "dispute") => {
    const a = await userOf(m.playerAId!);
    const b = await userOf(m.playerBId!);
    // mecze z udziałem prawdziwych kont zostają do rozegrania ręcznie
    if (!a || !b) return;
    const id = await M.submitReport(a, m.id, randomReport(m.bestOf, rnd(2) ? "A" : "B"));
    if (mode === "accept") await M.acceptReport(b, id);
    if (mode === "dispute") await M.disputeReport(b, id, "Druga gra zakończyła się inaczej – mam zrzut ekranu.");
    played++;
  };

  const groupMatches = await db.select().from(matches).where(and(eq(matches.tournamentId, t.id), eq(matches.stage, "GROUP")));
  let i = 0;
  for (const m of groupMatches) {
    i++;
    if (opts.bracket) await play(m, "accept");
    else if (i % 10 === 0) await play(m, "report");
    else if (i === 7) await play(m, "dispute");
    else if (i % 3 !== 0) await play(m, "accept");
  }

  // dostępność graczy demo i przykładowe terminy
  const hour = 3_600_000;
  const base = Math.ceil(Date.now() / (24 * hour)) * 24 * hour;
  for (const u of players.slice(0, Math.ceil(players.length * 0.7))) {
    const slots = [1, 2, 3, 5].map((d) => ({ userId: u.id, startsAt: new Date(base + d * 24 * hour + 17 * hour), endsAt: new Date(base + d * 24 * hour + 21 * hour) }));
    await db.insert(availabilitySlots).values(slots);
  }
  await scanAllProposals();
  const open = await db.select().from(matches).where(and(eq(matches.tournamentId, t.id), eq(matches.status, "PENDING")));
  for (const m of open.slice(0, 4)) {
    await db.update(matches).set({ scheduledAt: new Date(base + (1 + rnd(5)) * 24 * hour + (18 + rnd(3)) * hour) }).where(eq(matches.id, m.id));
  }

  let bracket = false;
  if (opts.bracket) {
    const data = await T.loadGroupStandings(t.id);
    for (const d of data) {
      if (d.standings.slice(0, 3).some((r) => r.tied)) await T.setGroupTiebreak(admin, d.group.id, d.standings.map((r) => r.participantId));
    }
    try {
      await T.generateBracket(admin);
      bracket = true;
      const ko = await db.select().from(matches).where(and(eq(matches.tournamentId, t.id), eq(matches.stage, "KNOCKOUT")));
      for (const m of ko.filter((x) => x.round === 1 && x.status === "PENDING").slice(0, Math.max(1, ko.length / 4))) await play(m, "accept");
    } catch (e) {
      // np. nierozegrane mecze prawdziwych kont – grupy zostają, drabinkę można wygenerować później
      if (!(e instanceof ServiceError)) throw e;
    }
  }

  await db.insert(announcements).values({
    tournamentId: t.id,
    title: DEMO_ANNOUNCEMENT,
    bodyMd: "Zapisy zakończone, grupy wylosowane. **Powodzenia!** Pamiętajcie o uzupełnieniu dostępności w profilu.",
    pinned: true,
    authorId: admin.id,
  });
  await logAction(admin.id, "DEMO_SEEDED", { entityType: "tournament", entityId: t.id, payload: { players: count, registered, played, bracket } });
  await publish(["content", "players", "groups", "matches", "bracket"]);

  return `Gracze: ${registered}, grupy: ${variant.label}, rozegrane mecze: ${played}${opts.bracket ? (bracket ? ", drabinka wygenerowana" : ", drabinki nie wygenerowano (nierozegrane mecze prawdziwych kont)") : ""}.`;
}

/**
 * Usuwa dane demo: WSZYSTKIE mecze i grupy bieżącego turnieju, konta demo z ich zgłoszeniami i ogłoszenie demo.
 * Prawdziwe zgłoszenia, treści i konfiguracja zostają; turniej wraca do fazy otwartych zapisów.
 */
export async function clearDemo(admin: SessionUser): Promise<number> {
  assertAdmin(admin);
  const t = await getTournament();
  const removed = await db.transaction(async (tx) => {
    // usunięcie meczów kaskadowo czyści raporty, spory, historię zmian i propozycje terminów
    await tx.delete(matches).where(eq(matches.tournamentId, t.id));
    await tx.delete(groups).where(eq(groups.tournamentId, t.id));
    const demo = (await tx.select({ id: users.id }).from(users).where(like(users.discordId, `${DEMO_PREFIX}%`))).map((r) => r.id);
    if (demo.length) {
      await tx.delete(participants).where(inArray(participants.userId, demo));
      await tx.update(adminAuditLog).set({ actorId: null }).where(inArray(adminAuditLog.actorId, demo));
      await tx.update(announcements).set({ authorId: null }).where(inArray(announcements.authorId, demo));
      await tx.delete(users).where(inArray(users.id, demo));
    }
    await tx.delete(announcements).where(and(eq(announcements.tournamentId, t.id), eq(announcements.title, DEMO_ANNOUNCEMENT)));
    await tx.update(tournaments).set({ phase: "REGISTRATION_OPEN", currentRoundLabel: null }).where(eq(tournaments.id, t.id));
    await logAction(admin.id, "DEMO_CLEARED", { entityType: "tournament", entityId: t.id, payload: { demoUsers: demo.length } }, tx);
    await publish(["content", "players", "groups", "matches", "bracket"], tx);
    return demo.length;
  });
  return removed;
}

export function demoDataEnabled() {
  return env().demoDataEnabled;
}
