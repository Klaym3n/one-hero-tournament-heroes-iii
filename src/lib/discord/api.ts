import "server-only";
import { env } from "@/lib/env";

const API = "https://discord.com/api/v10";

export class DiscordError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { auth?: "bot" | { bearer: string } } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const auth = init.auth ?? "bot";
  headers.set("Authorization", auth === "bot" ? `Bot ${env().DISCORD_BOT_TOKEN}` : `Bearer ${auth.bearer}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("User-Agent", "HoMM3TournamentBot (https://github.com, 1.0)");
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const retryAfterMs = res.status === 429 ? Math.ceil(Number(body.retry_after ?? 1) * 1000) : undefined;
    throw new DiscordError(body.message ?? `Discord API ${res.status}`, res.status, body.code, retryAfterMs);
  }
  return body as T;
}

// ---------- OAuth2 ----------
export const OAUTH_SCOPES = ["identify", "guilds.join"];

export function authorizeUrl(state: string): string {
  const e = env();
  const p = new URLSearchParams({
    client_id: e.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${e.APP_URL}/api/auth/discord/callback`,
    scope: OAUTH_SCOPES.join(" "),
    state,
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${p}`;
}

export type TokenResponse = { access_token: string; expires_in: number; refresh_token: string; scope: string };

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const e = env();
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: e.DISCORD_CLIENT_ID,
      client_secret: e.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${e.APP_URL}/api/auth/discord/callback`,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new DiscordError("Nie udało się wymienić kodu OAuth", res.status);
  return res.json();
}

export type DiscordUser = { id: string; username: string; global_name: string | null; avatar: string | null };

export function fetchMe(accessToken: string) {
  return call<DiscordUser>("/users/@me", { auth: { bearer: accessToken } });
}

export function avatarUrl(u: DiscordUser): string | null {
  return u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : null;
}

// ---------- Serwer (bot) ----------
export async function isGuildMember(discordUserId: string): Promise<boolean> {
  try {
    await call(`/guilds/${env().DISCORD_GUILD_ID}/members/${discordUserId}`);
    return true;
  } catch (e) {
    if (e instanceof DiscordError && e.status === 404) return false;
    throw e;
  }
}

/** Dodaje użytkownika na serwer (wymaga tokenu ze scope guilds.join i bota z uprawnieniem CREATE_INSTANT_INVITE). */
export async function addGuildMember(discordUserId: string, accessToken: string): Promise<void> {
  await call(`/guilds/${env().DISCORD_GUILD_ID}/members/${discordUserId}`, {
    method: "PUT",
    body: JSON.stringify({ access_token: accessToken }),
  });
}

export async function createInvite(): Promise<string | null> {
  const channel = env().DISCORD_CHANNEL_ID;
  if (!channel) return null;
  const inv = await call<{ code: string }>(`/channels/${channel}/invites`, {
    method: "POST",
    body: JSON.stringify({ max_age: 86400, max_uses: 1, unique: true }),
  });
  return `https://discord.gg/${inv.code}`;
}

// ---------- Wiadomości ----------
type AllowedMentions = { users?: string[]; parse?: string[] };

export async function sendChannelMessage(channelId: string, content: string, allowed: AllowedMentions = { parse: ["users"] }) {
  await call(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, allowed_mentions: allowed }),
  });
}

/** Kod błędu Discord: nie można wysłać wiadomości do użytkownika (zablokowane DM). */
export const CANNOT_DM = 50007;

export async function sendDirectMessage(discordUserId: string, content: string) {
  const ch = await call<{ id: string }>("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  await sendChannelMessage(ch.id, content, { parse: [] });
}

/** Dzieli długą wiadomość na części < 2000 znaków po liniach. */
export function splitMessage(text: string, limit = 1900): string[] {
  const parts: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if ((cur + "\n" + line).length > limit && cur) {
      parts.push(cur);
      cur = line;
    } else {
      cur = cur ? `${cur}\n${line}` : line;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}
