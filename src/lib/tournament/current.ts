import "server-only";
import { cache } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { heroes, mapTemplates, tournaments, type Tournament } from "@/db/schema";
import { defaultHeroSeeds } from "@/data/factions";
import { DEFAULT_TEMPLATES, DEFAULT_TOURNAMENT } from "./defaults";

async function ensureSeeded(): Promise<Tournament> {
  return db.transaction(async (tx) => {
    // blokada transakcyjna – zapobiega podwójnemu utworzeniu turnieju przy równoległych żądaniach
    await tx.execute(sql`select pg_advisory_xact_lock(4242)`);
    const [existing] = await tx.select().from(tournaments).orderBy(desc(tournaments.createdAt)).limit(1);
    if (existing) return existing;
    const [t] = await tx.insert(tournaments).values(DEFAULT_TOURNAMENT).returning();
    await tx.insert(mapTemplates).values(DEFAULT_TEMPLATES.map((m, i) => ({ ...m, tournamentId: t.id, sortOrder: i })));
    await tx.insert(heroes).values(defaultHeroSeeds()).onConflictDoNothing();
    return t;
  });
}

/** Aktualny (najnowszy) turniej; przy pierwszym uruchomieniu tworzy domyślny. */
export const getTournament = cache(async (): Promise<Tournament> => {
  const [t] = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt)).limit(1);
  return t ?? ensureSeeded();
});

export const getTemplates = cache(async (tournamentId: string, onlyActive = true) => {
  const rows = await db
    .select()
    .from(mapTemplates)
    .where(eq(mapTemplates.tournamentId, tournamentId))
    .orderBy(asc(mapTemplates.sortOrder), asc(mapTemplates.name));
  return onlyActive ? rows.filter((r) => r.active) : rows;
});

export const getHeroes = cache(async (onlyActive = true) => {
  const rows = await db.select().from(heroes).orderBy(asc(heroes.faction), asc(heroes.heroClass), asc(heroes.name));
  return onlyActive ? rows.filter((h) => h.active) : rows;
});
