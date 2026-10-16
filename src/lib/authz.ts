import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@/db/schema";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

const RANK: Record<Role, number> = { PLAYER: 0, MODERATOR: 1, ADMIN: 2 };

export function hasRole(user: Pick<SessionUser, "role"> | null | undefined, role: Role): boolean {
  return !!user && RANK[user.role] >= RANK[role];
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: "UNAUTHENTICATED" | "FORBIDDEN",
  ) {
    super(message);
  }
}

/** Dla Server Actions / Route Handlers – rzuca AuthError. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Musisz być zalogowany.", "UNAUTHENTICATED");
  return user;
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user, role)) throw new AuthError("Brak uprawnień.", "FORBIDDEN");
  return user;
}

/** Dla stron: przekierowanie do logowania. */
export async function pageRequireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/logowanie?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Dla stron panelu: 404 zamiast ujawniania istnienia panelu. */
export async function pageRequireRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!hasRole(user, role)) notFound();
  return user!;
}
