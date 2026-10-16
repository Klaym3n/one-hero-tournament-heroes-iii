import { cookies } from "next/headers";
import { connection, NextResponse, type NextRequest } from "next/server";
import { authorizeUrl } from "@/lib/discord/api";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/safe-redirect";

export async function GET(req: NextRequest) {
  // konfiguracja jest czytana w czasie żądania (zmienne środowiskowe kontenera), nigdy przy buildzie
  await connection();
  const e = env();
  if (!e.DISCORD_CLIENT_ID) {
    return NextResponse.redirect(new URL("/logowanie?blad=konfiguracja", e.APP_URL));
  }
  const state = randomToken(16);
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const store = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: e.APP_URL.startsWith("https://"), path: "/", maxAge: 600 };
  store.set("oauth_state", state, opts);
  store.set("oauth_next", next, opts);
  return NextResponse.redirect(authorizeUrl(state));
}
