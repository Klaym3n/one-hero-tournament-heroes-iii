import "server-only";
import { inArray } from "drizzle-orm";
import { db, type DBOrTx } from "@/db";
import { discordOutbox, notifications, users } from "@/db/schema";
import { env } from "@/lib/env";
import { splitMessage } from "@/lib/discord/api";

export type NotifyInput = {
  type: string;
  title: string;
  body?: string;
  href?: string;
  /** Treść DM na Discordzie (domyślnie tytuł + opis + link) */
  discord?: string | false;
};

function absolute(href?: string) {
  return href ? `${env().APP_URL}${href}` : "";
}

/**
 * Powiadomienie w serwisie + DM na Discordzie (przez outbox).
 * Jeśli gracz ma zablokowane DM, wiadomość trafi na kanał turniejowy z oznaczeniem.
 */
export async function notifyUsers(userIds: string[], input: NotifyInput, tx: DBOrTx = db) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await tx.insert(notifications).values(
    ids.map((userId) => ({ userId, type: input.type, title: input.title, body: input.body ?? "", href: input.href })),
  );
  if (input.discord === false) return;
  const rows = await tx.select({ id: users.id, discordId: users.discordId }).from(users).where(inArray(users.id, ids));
  const text =
    input.discord ?? [`**${input.title}**`, input.body, input.href ? absolute(input.href) : null].filter(Boolean).join("\n");
  const channel = env().DISCORD_CHANNEL_ID;
  const real = rows.filter((r) => /^\d+$/.test(r.discordId)); // konta testowe (dev) pomijamy
  if (!real.length) return;
  await tx.insert(discordOutbox).values(
    real.map((r) => ({
      kind: "DM" as const,
      target: r.discordId,
      content: text,
      fallbackContent: channel ? `<@${r.discordId}> ${text}` : null,
    })),
  );
}

/** Wiadomość na kanale turniejowym (np. ogłoszenie rundy z oznaczeniami). */
export async function queueChannelMessage(content: string, tx: DBOrTx = db, channelId = env().DISCORD_CHANNEL_ID) {
  if (!channelId) throw new Error("Nie skonfigurowano DISCORD_CHANNEL_ID");
  const parts = splitMessage(content);
  await tx.insert(discordOutbox).values(parts.map((p) => ({ kind: "CHANNEL" as const, target: channelId, content: p })));
  return parts.length;
}
