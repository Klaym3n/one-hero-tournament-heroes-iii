import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { logAction } from "@/lib/audit";

type Profile = { discordId: string; username: string; globalName: string | null; avatarUrl: string | null };
type Token = { accessToken: string; expiresIn: number };

/** Tworzy/aktualizuje konto po zalogowaniu. Konta z ADMIN_DISCORD_IDS dostają rolę ADMIN (mechanizm "pierwszego admina"). */
export async function upsertDiscordUser(p: Profile, token?: Token) {
  const bootstrapAdmin = env().adminDiscordIds.includes(p.discordId);
  const [existing] = await db.select({ role: users.role }).from(users).where(eq(users.discordId, p.discordId));
  const fields = {
    discordUsername: p.username,
    discordGlobalName: p.globalName,
    avatarUrl: p.avatarUrl,
    lastLoginAt: new Date(),
    ...(token
      ? {
          discordAccessToken: encrypt(token.accessToken),
          discordTokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
        }
      : {}),
    ...(bootstrapAdmin ? { role: "ADMIN" as const } : {}),
  };
  const [row] = await db
    .insert(users)
    .values({ discordId: p.discordId, ...fields })
    .onConflictDoUpdate({ target: users.discordId, set: fields })
    .returning();

  if (bootstrapAdmin && existing?.role !== "ADMIN") {
    await logAction(row.id, "ADMIN_BOOTSTRAP", { entityType: "user", entityId: row.id });
  }
  return row;
}
