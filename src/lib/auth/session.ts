import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "homm_session";
const SESSION_DAYS = 30;

export type SessionUser = Pick<
  User,
  "id" | "discordId" | "discordUsername" | "discordGlobalName" | "avatarUrl" | "role" | "banned"
>;

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().APP_URL.startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  store.delete(SESSION_COOKIE);
}

/** Aktualnie zalogowany użytkownik (memoizowane w obrębie żądania). Zbanowani traktowani jak niezalogowani. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: users.id,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordGlobalName: users.discordGlobalName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      banned: users.banned,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);
  if (!row || row.banned) return null;
  return row;
});
