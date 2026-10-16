/**
 * Test integracyjny całego przebiegu turnieju na prawdziwej bazie PostgreSQL.
 * Wymaga działającej bazy: `npm run db:local` (baza homm3_test) lub TEST_DATABASE_URL.
 */
import { beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/homm3_test";
process.env.DATABASE_URL = TEST_URL;
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.DISCORD_BOT_TOKEN = "";
process.env.DISCORD_CHANNEL_ID = "";

let reachable = true;

type Mods = {
  db: typeof import("@/db");
  schema: typeof import("@/db/schema");
  current: typeof import("@/lib/tournament/current");
  t: typeof import("@/server/tournament");
  m: typeof import("@/server/matches");
  drizzle: typeof import("drizzle-orm");
};
let M: Mods;

type U = import("@/lib/auth/session").SessionUser;
const users: U[] = [];
let admin: U;
let moderator: U;

beforeAll(async () => {
  const sql = postgres(TEST_URL, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade;");
  } catch {
    reachable = false;
    await sql.end();
    return;
  }
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();

  M = {
    db: await import("@/db"),
    schema: await import("@/db/schema"),
    current: await import("@/lib/tournament/current"),
    t: await import("@/server/tournament"),
    m: await import("@/server/matches"),
    drizzle: await import("drizzle-orm"),
  };
  const mk = async (name: string, role: "PLAYER" | "MODERATOR" | "ADMIN" = "PLAYER") => {
    const [u] = await M.db.db
      .insert(M.schema.users)
      .values({ discordId: `dev-${name}`, discordUsername: name, role })
      .returning();
    return { ...u } as U;
  };
  admin = await mk("admin", "ADMIN");
  moderator = await mk("mod", "MODERATOR");
  for (let i = 0; i < 18; i++) users.push(await mk(`gracz${i}`));
});

async function sampleGames(matchId: string, winners: ("A" | "B")[]) {
  const heroes = await M.current.getHeroes(true);
  const tour = await M.current.getTournament();
  const templates = await M.current.getTemplates(tour.id, true);
  const castle = heroes.filter((h) => h.faction === "castle");
  const necro = heroes.filter((h) => h.faction === "necropolis");
  void matchId;
  return {
    games: winners.map((w, i) => ({
      winner: w,
      mapTemplateId: templates[i % templates.length].id,
      factionA: "castle",
      factionB: "necropolis",
      heroA: castle[i].slug,
      heroB: necro[i].slug,
      day: { month: 1, week: 3, day: 4 },
    })),
    summary: "Test",
  };
}

async function userOf(participantId: string) {
  const { eq } = M.drizzle;
  const [p] = await M.db.db.select().from(M.schema.participants).where(eq(M.schema.participants.id, participantId));
  return users.find((u) => u.id === p.userId)!;
}

async function playMatch(match: { id: string; playerAId: string | null; playerBId: string | null; bestOf: number }, winner: "A" | "B") {
  const a = await userOf(match.playerAId!);
  const b = await userOf(match.playerBId!);
  const need = Math.ceil(match.bestOf / 2);
  const games = Array.from({ length: need }, () => winner);
  const reportId = await M.m.submitReport(a, match.id, await sampleGames(match.id, games));
  await M.m.acceptReport(b, reportId);
}

describe("pełny przebieg turnieju", () => {
  it("zapisy", async () => {
    if (!reachable) return console.warn("Pominięto: brak bazy testowej");
    await M.current.getTournament();
    await expect(M.t.register(users[0], { nick: "Gracz0", acceptRules: true, acceptPrivacy: true })).rejects.toThrow(/zamknięte/);
    await M.t.setPhase(admin, "REGISTRATION_OPEN");
    await expect(M.t.setPhase(users[0], "REGISTRATION_CLOSED")).rejects.toThrow(/Administratora/);
    await expect(M.t.setPhase(moderator, "REGISTRATION_CLOSED")).rejects.toThrow(/Administratora/);
    for (let i = 0; i < users.length; i++) {
      const r = await M.t.register(users[i], { nick: `Gracz ${i}`, acceptRules: true, acceptPrivacy: true });
      expect(r.status).toBe("registered");
    }
    await expect(M.t.register(users[0], { nick: "Inny", acceptRules: true, acceptPrivacy: true })).rejects.toThrow(/już zapisany/);
    await expect(M.t.register(moderator, { nick: "gracz 3", acceptRules: true, acceptPrivacy: true })).rejects.toThrow(/zajęty/);
    await expect(M.t.register(moderator, { nick: "Mod", acceptRules: false, acceptPrivacy: true })).rejects.toThrow(/regulamin/);
  });

  it("losowanie grup", async () => {
    if (!reachable) return;
    await expect(M.t.drawTournamentGroups(admin, 4)).rejects.toThrow(/zamknięciu zapisów/);
    await M.t.setPhase(admin, "REGISTRATION_CLOSED");
    const { players, variants } = await M.t.groupVariants();
    expect(players).toBe(18);
    expect(variants.map((v) => v.groupCount)).toEqual([4]);
    await M.t.drawTournamentGroups(admin, 4);
    await expect(M.t.drawTournamentGroups(admin, 4)).rejects.toThrow();
    const tour = await M.current.getTournament();
    const data = await M.t.loadGroupStandings(tour.id);
    expect(data.map((d) => d.standings.length).sort()).toEqual([4, 4, 5, 5]);
    expect(data.reduce((a, d) => a + d.matches.length, 0)).toBe(10 + 10 + 6 + 6);
  });

  it("raporty, akceptacja i spór w fazie grupowej", async () => {
    if (!reachable) return;
    const { eq } = M.drizzle;
    const tour = await M.current.getTournament();
    const groupMatches = await M.db.db.select().from(M.schema.matches).where(eq(M.schema.matches.stage, "GROUP"));

    // obcy gracz nie może raportować
    const first = groupMatches[0];
    const a = await userOf(first.playerAId!);
    const b = await userOf(first.playerBId!);
    const outsider = users.find((u) => u.id !== a.id && u.id !== b.id)!;
    await expect(M.m.submitReport(outsider, first.id, await sampleGames(first.id, ["A", "A"]))).rejects.toThrow(/uczestnikiem/);
    // nieprawidłowy raport
    await expect(M.m.submitReport(a, first.id, await sampleGames(first.id, ["A", "B"]))).rejects.toThrow();

    // spór: A zgłasza 2:0, B kwestionuje, moderator rozstrzyga
    const rid = await M.m.submitReport(a, first.id, await sampleGames(first.id, ["A", "A"]));
    await expect(M.m.acceptReport(a, rid)).rejects.toThrow(/własnego/);
    await M.m.disputeReport(b, rid, "Wynik był odwrotny");
    const [disputed] = await M.db.db.select().from(M.schema.matches).where(eq(M.schema.matches.id, first.id));
    expect(disputed.status).toBe("DISPUTED");
    await expect(M.m.staffAcceptReport(users[5], rid, "ok")).rejects.toThrow(/uprawnień/);
    await M.m.staffAcceptReport(moderator, rid, "Potwierdzone nagraniem");
    const [resolved] = await M.db.db.select().from(M.schema.matches).where(eq(M.schema.matches.id, first.id));
    expect(resolved).toMatchObject({ status: "CONFIRMED", scoreA: 2, scoreB: 0, winnerId: first.playerAId });

    // kontr-raport: obaj zgłaszają różne wyniki → spór
    const second = groupMatches[1];
    const a2 = await userOf(second.playerAId!);
    const b2 = await userOf(second.playerBId!);
    await M.m.submitReport(a2, second.id, await sampleGames(second.id, ["A", "A"]));
    await M.m.submitReport(b2, second.id, await sampleGames(second.id, ["B", "B"]));
    const [counter] = await M.db.db.select().from(M.schema.matches).where(eq(M.schema.matches.id, second.id));
    expect(counter.status).toBe("DISPUTED");
    await M.m.staffSetResult(moderator, second.id, await sampleGames(second.id, ["B", "A", "B"]), "Ustalone z graczami");
    const [fixed] = await M.db.db.select().from(M.schema.matches).where(eq(M.schema.matches.id, second.id));
    expect(fixed).toMatchObject({ status: "CONFIRMED", scoreA: 1, scoreB: 2 });

    // historia zmian
    const revs = await M.db.db.select().from(M.schema.matchRevisions).where(eq(M.schema.matchRevisions.matchId, second.id));
    expect(revs.map((r) => r.action)).toEqual(expect.arrayContaining(["REPORT_SUBMITTED", "COUNTER_REPORT", "STAFF_EDIT"]));

    // drabinka niedostępna przed końcem grup
    await expect(M.t.generateBracket(admin)).rejects.toThrow(/zakończone/);

    // rozegraj resztę: wygrywa gracz o niższym miejscu przy stole (seat) – deterministycznie
    for (const gm of groupMatches.slice(2)) await playMatch(gm, gm.playerAId! < gm.playerBId! ? "A" : "B");
    const data = await M.t.loadGroupStandings(tour.id);
    expect(data.every((d) => d.complete)).toBe(true);
    for (const d of data) {
      if (d.standings.slice(0, 3).some((r) => r.tied)) {
        await M.t.setGroupTiebreak(admin, d.group.id, d.standings.map((r) => r.participantId));
      }
    }
  });

  it("drabinka i faza pucharowa do końca turnieju", async () => {
    if (!reachable) return;
    const { eq, and, inArray } = M.drizzle;
    await M.t.generateBracket(admin);
    const tour = await M.current.getTournament();
    expect(tour.phase).toBe("KNOCKOUT");
    const ko = await M.db.db.select().from(M.schema.matches).where(inArray(M.schema.matches.stage, ["KNOCKOUT", "THIRD_PLACE"]));
    expect(ko.length).toBe(8); // 4 QF + 2 SF + finał + o 3. miejsce
    expect(ko.filter((m) => m.status === "PENDING").length).toBe(4);
    const final = ko.find((m) => m.stage === "KNOCKOUT" && !m.nextMatchId)!;
    expect(final.bestOf).toBe(5);

    // ćwierćfinały
    const qf = ko.filter((m) => m.round === 1);
    for (const m of qf) await playMatch(m, "A");
    // korekta wyniku QF bez wymuszenia przy nierozegranym półfinale – dozwolona
    await M.m.staffSetResult(moderator, qf[0].id, await sampleGames(qf[0].id, ["B", "B"]), "Pomyłka w raporcie");
    const [semi] = await M.db.db.select().from(M.schema.matches).where(eq(M.schema.matches.id, qf[0].nextMatchId!));
    expect([semi.playerAId, semi.playerBId]).toContain(qf[0].playerBId);

    // półfinały
    const semis = await M.db.db
      .select()
      .from(M.schema.matches)
      .where(and(eq(M.schema.matches.stage, "KNOCKOUT"), eq(M.schema.matches.round, 2)));
    expect(semis.every((s) => s.status === "PENDING")).toBe(true);
    for (const s of semis) await playMatch(s, "A");

    // teraz zmiana QF wymaga wymuszenia
    await expect(M.m.staffSetResult(moderator, qf[0].id, await sampleGames(qf[0].id, ["A", "A"]), "x y z")).rejects.toThrow(/wymuszenia/);

    // mecz o 3. miejsce i finał
    const [third] = await M.db.db.select().from(M.schema.matches).where(eq(M.schema.matches.stage, "THIRD_PLACE"));
    expect(third.status).toBe("PENDING");
    await playMatch(third, "B");
    const [fin] = await M.db.db.select().from(M.schema.matches).where(eq(M.schema.matches.id, final.id));
    expect(fin.status).toBe("PENDING");
    await playMatch(fin, "A");
    const done = await M.current.getTournament();
    // getTournament jest memoizowane tylko w RSC – tutaj czytamy świeżo
    const [fresh] = await M.db.db.select().from(M.schema.tournaments).where(eq(M.schema.tournaments.id, done.id));
    expect(fresh.phase).toBe("FINISHED");

    // log audytu zawiera kluczowe akcje
    const log = await M.db.db.select({ a: M.schema.adminAuditLog.action }).from(M.schema.adminAuditLog);
    expect(log.map((l) => l.a)).toEqual(expect.arrayContaining(["PHASE_CHANGE", "GROUPS_DRAWN", "BRACKET_GENERATED", "MATCH_EDIT", "DISPUTE_RESOLVED"]));
  });

  it("role: nie można odebrać roli ostatniemu adminowi", async () => {
    if (!reachable) return;
    await expect(M.t.setUserRole(admin, admin.id, "PLAYER")).rejects.toThrow(/ostatniemu/);
    await expect(M.t.setUserRole(moderator, users[0].id, "ADMIN")).rejects.toThrow(/Administratora/);
    await M.t.setUserRole(admin, users[0].id, "MODERATOR");
  });
});
