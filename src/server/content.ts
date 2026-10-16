import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, heroes, mapTemplates } from "@/db/schema";
import { getTournament } from "@/lib/tournament/current";
import { heroSlug, isFactionSlug } from "@/data/factions";
import { logAction } from "@/lib/audit";
import { publish } from "@/lib/realtime";
import { hasRole } from "@/lib/authz";
import type { SessionUser } from "@/lib/auth/session";
import { ServiceError } from "./errors";

function assertAdmin(user: SessionUser) {
  if (!hasRole(user, "ADMIN")) throw new ServiceError("Ta operacja wymaga roli Administratora.");
}

// ---------- Szablony map ----------
export async function saveTemplate(admin: SessionUser, input: { id?: string; name: string; description: string; active: boolean; sortOrder: number }) {
  assertAdmin(admin);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) throw new ServiceError("Nazwa szablonu: 2–60 znaków.");
  const t = await getTournament();
  const values = { name, description: input.description.trim().slice(0, 300), active: input.active, sortOrder: input.sortOrder | 0 };
  if (input.id) {
    await db.update(mapTemplates).set(values).where(and(eq(mapTemplates.id, input.id), eq(mapTemplates.tournamentId, t.id)));
  } else {
    await db.insert(mapTemplates).values({ ...values, tournamentId: t.id });
  }
  await logAction(admin.id, "TEMPLATE_UPDATE", { entityType: "map_template", entityId: input.id, payload: values });
  await publish(["content"]);
}

export async function deleteTemplate(admin: SessionUser, id: string) {
  assertAdmin(admin);
  const t = await getTournament();
  // raporty zachowują historię (map_template_id → null); bezpieczniej dezaktywować
  await db.update(mapTemplates).set({ active: false }).where(and(eq(mapTemplates.id, id), eq(mapTemplates.tournamentId, t.id)));
  await logAction(admin.id, "TEMPLATE_UPDATE", { entityType: "map_template", entityId: id, payload: { deactivated: true } });
  await publish(["content"]);
}

// ---------- Bohaterowie ----------
export async function saveHero(admin: SessionUser, input: { slug?: string; name: string; faction: string; heroClass: number; active: boolean }) {
  assertAdmin(admin);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 40) throw new ServiceError("Imię bohatera: 2–40 znaków.");
  if (!isFactionSlug(input.faction)) throw new ServiceError("Nieznana frakcja.");
  const values = { name, faction: input.faction, heroClass: input.heroClass === 1 ? 1 : 0, active: input.active };
  if (input.slug) {
    await db.update(heroes).set(values).where(eq(heroes.slug, input.slug));
  } else {
    let slug = heroSlug(name);
    const [exists] = await db.select({ s: heroes.slug }).from(heroes).where(eq(heroes.slug, slug));
    if (exists) slug = `${slug}-${input.faction}`;
    await db.insert(heroes).values({ ...values, slug });
  }
  await logAction(admin.id, "HERO_UPDATE", { entityType: "hero", entityId: input.slug, payload: values });
}

// ---------- Ogłoszenia ----------
export async function saveAnnouncement(admin: SessionUser, input: { id?: string; title: string; bodyMd: string; pinned: boolean; published: boolean }) {
  assertAdmin(admin);
  const title = input.title.trim();
  if (title.length < 3 || title.length > 120) throw new ServiceError("Tytuł: 3–120 znaków.");
  if (input.bodyMd.length > 10_000) throw new ServiceError("Treść jest za długa.");
  const t = await getTournament();
  const values = { title, bodyMd: input.bodyMd, pinned: input.pinned, published: input.published };
  if (input.id) await db.update(announcements).set(values).where(and(eq(announcements.id, input.id), eq(announcements.tournamentId, t.id)));
  else await db.insert(announcements).values({ ...values, tournamentId: t.id, authorId: admin.id });
  await logAction(admin.id, "ANNOUNCEMENT", { entityType: "announcement", entityId: input.id, payload: { title } });
  await publish(["content"]);
}

export async function deleteAnnouncement(admin: SessionUser, id: string) {
  assertAdmin(admin);
  await db.delete(announcements).where(eq(announcements.id, id));
  await logAction(admin.id, "ANNOUNCEMENT", { entityType: "announcement", entityId: id, payload: { deleted: true } });
  await publish(["content"]);
}
