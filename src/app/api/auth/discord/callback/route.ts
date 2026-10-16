import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { avatarUrl, exchangeCode, fetchMe } from "@/lib/discord/api";
import { upsertDiscordUser } from "@/lib/auth/users";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/safe-redirect";

export async function GET(req: NextRequest) {
  const base = env().APP_URL;
  const store = await cookies();
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  const expected = store.get("oauth_state")?.value;
  const next = safeNext(store.get("oauth_next")?.value);
  store.delete("oauth_state");
  store.delete("oauth_next");

  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL("/logowanie?blad=stan", base));
  }
  try {
    const token = await exchangeCode(code);
    const me = await fetchMe(token.access_token);
    const user = await upsertDiscordUser(
      { discordId: me.id, username: me.username, globalName: me.global_name, avatarUrl: avatarUrl(me) },
      { accessToken: token.access_token, expiresIn: token.expires_in },
    );
    if (user.banned) return NextResponse.redirect(new URL("/logowanie?blad=ban", base));
    await createSession(user.id);
    return NextResponse.redirect(new URL(next, base));
  } catch (err) {
    console.error("[auth] Discord callback", err);
    return NextResponse.redirect(new URL("/logowanie?blad=discord", base));
  }
}
