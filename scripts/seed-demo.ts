/**
 * Dane demonstracyjne (TYLKO development): npm run db:seed -- --players=24 [--bracket]
 * Tworzy graczy testowych, losuje grupy, rozgrywa część meczów (raporty + akceptacje, jeden spór).
 * Zaloguj się jako admin przez /api/auth/dev?name=admin (wymaga DEV_LOGIN=true).
 */
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";

if (process.env.NODE_ENV === "production") {
  console.error("Seed demo jest zablokowany w produkcji.");
  process.exit(1);
}

const arg = (name: string, def: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const flag = (name: string) => process.argv.includes(`--${name}`);

const NICKS = [
  "Smoczy_Lord", "Gelu_Fan", "Nekromanta", "Krasnolud", "Archanioł", "Behemot", "Feniks", "Hydra",
  "Tytan", "Czarny_Smok", "Minotaur", "Gryf", "Ifryt", "Licz", "Wampir", "Cyklop",
  "Mantikora", "Naga", "Diabeł", "Rycerz_Mroku", "Pegaz", "Jednorożec", "Golem", "Bazyliszek",
  "Wywerna", "Kraken", "Meduza", "Troglodyta", "Harpia", "Ogr", "Ent", "Elf",
];

async function main() {
  const { db } = await import("../src/db");
  const S = await import("../src/db/schema");
  const T = await import("../src/server/tournament");
  const M = await import("../src/server/matches");
  const current = await import("../src/lib/tournament/current");
  const { proposeGroupVariants } = await import("../src/lib/tournament/groups");

  const count = Math.max(4, Math.min(NICKS.length * 4, Number(arg("players", "24"))));
  const rnd = (n: number) => Math.floor(Math.random() * n);

  // administrator demo
  const [admin] = await db
    .insert(S.users)
    .values({ discordId: "dev-admin", discordUsername: "admin", discordGlobalName: "Admin", role: "ADMIN" })
    .onConflictDoUpdate({ target: S.users.discordId, set: { role: "ADMIN" } })
    .returning();
  await db
    .insert(S.users)
    .values({ discordId: "dev-moderator", discordUsername: "moderator", discordGlobalName: "Moderator", role: "MODERATOR" })
    .onConflictDoNothing();

  let t = await current.getTournament();
  if (t.phase !== "DRAFT" && t.phase !== "REGISTRATION_OPEN") {
    console.log(`Turniej jest w fazie ${t.phase} – uruchom 'npm run db:reset-demo', aby zacząć od nowa.`);
    process.exit(0);
  }
  if (t.phase === "DRAFT") await T.setPhase(admin, "REGISTRATION_OPEN");

  const players: (typeof S.users.$inferSelect)[] = [];
  for (let i = 0; i < count; i++) {
    const nick = i < NICKS.length ? NICKS[i] : `${NICKS[i % NICKS.length]}_${Math.floor(i / NICKS.length)}`;
    const name = `demo${i}`;
    const [u] = await db
      .insert(S.users)
      .values({ discordId: `dev-${name}`, discordUsername: name, discordGlobalName: nick })
      .onConflictDoUpdate({ target: S.users.discordId, set: { discordGlobalName: nick } })
      .returning();
    players.push(u);
    try {
      await T.register(u, { nick, acceptRules: true, acceptPrivacy: true });
    } catch {
      // już zapisany
    }
  }
  console.log(`Graczy: ${players.length}`);

  await T.setPhase(admin, "REGISTRATION_CLOSED");
  const variants = proposeGroupVariants(players.length);
  const variant = variants.find((v) => !v.outOfRange) ?? variants[0];
  await T.drawTournamentGroups(admin, variant.groupCount);
  console.log(`Wylosowano: ${variant.label}`);

  const heroes = await current.getHeroes(true);
  t = await current.getTournament();
  const templates = await current.getTemplates(t.id, true);
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
        const fa = pick(factions);
        const fb = pick(factions);
        return {
          winner: s,
          mapTemplateId: pick(templates).id,
          factionA: fa,
          factionB: fb,
          heroA: pick(heroes.filter((h) => h.faction === fa)).slug,
          heroB: pick(heroes.filter((h) => h.faction === fb)).slug,
          day: { month: 1 + rnd(3), week: 1 + rnd(4), day: 1 + rnd(7) },
          notes: rnd(4) === 0 ? "Decydująca bitwa na neutralnych smokach." : "",
        };
      }),
      summary: rnd(3) === 0 ? "Wyrównany mecz, rozstrzygnięty w ostatniej bitwie." : "",
    };
  };

  const userOf = async (participantId: string) => {
    const [p] = await db.select().from(S.participants).where(eq(S.participants.id, participantId));
    return players.find((u) => u.id === p.userId)!;
  };

  const play = async (m: typeof S.matches.$inferSelect, mode: "accept" | "report" | "dispute") => {
    const a = await userOf(m.playerAId!);
    const b = await userOf(m.playerBId!);
    const rep = randomReport(m.bestOf, rnd(2) ? "A" : "B");
    const id = await M.submitReport(a, m.id, rep);
    if (mode === "accept") await M.acceptReport(b, id);
    if (mode === "dispute") await M.disputeReport(b, id, "Druga gra zakończyła się inaczej – mam zrzut ekranu.");
  };

  const groupMatches = await db.select().from(S.matches).where(eq(S.matches.stage, "GROUP"));
  const finishGroups = flag("bracket");
  let i = 0;
  for (const m of groupMatches) {
    i++;
    if (finishGroups) await play(m, "accept");
    else if (i % 10 === 0) await play(m, "report");
    else if (i === 7) await play(m, "dispute");
    else if (i % 3 !== 0) await play(m, "accept");
  }

  // dostępność i terminy
  const now = Date.now();
  const hour = 3_600_000;
  const base = Math.ceil(now / (24 * hour)) * 24 * hour;
  for (const u of players.slice(0, Math.ceil(players.length * 0.7))) {
    const slots = [1, 2, 3, 5].map((d) => ({ userId: u.id, startsAt: new Date(base + d * 24 * hour + 17 * hour), endsAt: new Date(base + d * 24 * hour + 21 * hour) }));
    await db.insert(S.availabilitySlots).values(slots);
  }
  const { scanAllProposals } = await import("../src/server/scheduling");
  await scanAllProposals();
  const open = await db.select().from(S.matches).where(inArray(S.matches.status, ["PENDING"]));
  for (const m of open.slice(0, 4)) {
    await db.update(S.matches).set({ scheduledAt: new Date(base + (1 + rnd(5)) * 24 * hour + (18 + rnd(3)) * hour) }).where(eq(S.matches.id, m.id));
  }

  if (finishGroups) {
    const data = await T.loadGroupStandings(t.id);
    for (const d of data) {
      if (d.standings.slice(0, 3).some((r) => r.tied)) await T.setGroupTiebreak(admin, d.group.id, d.standings.map((r) => r.participantId));
    }
    await T.generateBracket(admin);
    const ko = await db.select().from(S.matches).where(eq(S.matches.stage, "KNOCKOUT"));
    for (const m of ko.filter((x) => x.round === 1 && x.status === "PENDING").slice(0, Math.max(1, ko.length / 4))) await play(m, "accept");
    console.log("Wygenerowano drabinkę.");
  }

  await db.insert(S.announcements).values({
    tournamentId: t.id,
    title: "Witajcie w turnieju!",
    bodyMd: "Zapisy zakończone, grupy wylosowane. **Powodzenia!** Pamiętajcie o uzupełnieniu dostępności w profilu.",
    pinned: true,
    authorId: admin.id,
  });

  console.log("Gotowe. Zaloguj się: /api/auth/dev?name=admin (admin) lub ?name=demo0 (gracz).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
