import { cookies } from "next/headers";
import { connection, NextResponse, type NextRequest } from "next/server";
import { avatarUrl, exchangeCode, fetchMe } from "@/lib/discord/api";
import { upsertDiscordUser } from "@/lib/auth/users";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/safe-redirect";
import { log } from "@/lib/log";

export async function GET(req: NextRequest) {
  // konfiguracja jest czytana w czasie żądania (zmienne środowiskowe kontenera), nigdy przy buildzie
  await connection();
  const base = env().APP_URL;
  const store = await cookies();
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  const expected = store.get("oauth_state")?.value;
  const next = safeNext(store.get("oauth_next")?.value);
  store.delete("oauth_state");
  store.delete("oauth_next");

  if (!code || !state || !expected || state !== expected) {
    log.warn("auth", `odrzucone logowanie Discord – nieprawidłowy stan OAuth${req.nextUrl.searchParams.get("error") ? ` (${req.nextUrl.searchParams.get("error")})` : ""}`);
    return NextResponse.redirect(new URL("/logowanie?blad=stan", base));
  }
  try {
    const token = await exchangeCode(code);
    const me = await fetchMe(token.access_token);
    const user = await upsertDiscordUser(
      { discordId: me.id, username: me.username, globalName: me.global_name, avatarUrl: avatarUrl(me) },
      { accessToken: token.access_token, expiresIn: token.expires_in },
    );
    if (user.banned) {
      log.warn("auth", "próba logowania zbanowanego konta", user);
      return NextResponse.redirect(new URL("/logowanie?blad=ban", base));
    }
    await createSession(user.id);
    log.info("auth", user.created ? "nowe konto – pierwsze logowanie przez Discord" : "zalogował(a) się przez Discord", user);
    return NextResponse.redirect(new URL(next, base));
  } catch (err) {
    log.error("auth", "błąd logowania przez Discord", err);
    return NextResponse.redirect(new URL("/logowanie?blad=discord", base));
  }
}
