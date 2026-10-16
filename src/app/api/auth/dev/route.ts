import { connection, NextResponse, type NextRequest } from "next/server";
import { upsertDiscordUser } from "@/lib/auth/users";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/safe-redirect";

/** Logowanie testowe bez Discorda – tylko gdy DEV_LOGIN=true i NODE_ENV != production. */
export async function GET(req: NextRequest) {
  // konfiguracja jest czytana w czasie żądania (zmienne środowiskowe kontenera), nigdy przy buildzie
  await connection();
  const e = env();
  if (!e.devLoginEnabled) return new NextResponse("Not found", { status: 404 });
  const name = (req.nextUrl.searchParams.get("name") ?? "tester").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) || "tester";
  const discordId = req.nextUrl.searchParams.get("id") ?? `dev-${name}`;
  const user = await upsertDiscordUser({ discordId, username: name, globalName: name, avatarUrl: null });
  await createSession(user.id);
  return NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next")), e.APP_URL));
}
