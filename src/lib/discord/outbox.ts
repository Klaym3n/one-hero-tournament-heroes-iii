import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/lib/env";
import { CANNOT_DM, DiscordError, sendChannelMessage, sendDirectMessage } from "./api";

const MAX_ATTEMPTS = 6;

type Row = {
  id: string;
  kind: "DM" | "CHANNEL";
  target: string;
  content: string;
  fallback_content: string | null;
  attempts: number;
};

/** Wysyła zaległe wiadomości Discord. Bezpieczne przy wielu instancjach (SKIP LOCKED). */
export async function processOutbox(batch = 20): Promise<number> {
  if (!env().DISCORD_BOT_TOKEN) return 0;
  let sent = 0;
  await db.transaction(async (tx) => {
    const rows = (await tx.execute(sql`
      select id, kind, target, content, fallback_content, attempts from discord_outbox
      where sent_at is null and failed_at is null and next_attempt_at <= now()
      order by created_at
      limit ${batch}
      for update skip locked
    `)) as unknown as Row[];

    for (const row of rows) {
      try {
        if (row.kind === "DM") {
          try {
            await sendDirectMessage(row.target, row.content);
          } catch (e) {
            if (e instanceof DiscordError && e.code === CANNOT_DM && row.fallback_content) {
              await sendChannelMessage(env().DISCORD_CHANNEL_ID, row.fallback_content, { users: [row.target] });
            } else throw e;
          }
        } else {
          await sendChannelMessage(row.target, row.content);
        }
        await tx.execute(sql`update discord_outbox set sent_at = now(), attempts = attempts + 1 where id = ${row.id}`);
        sent++;
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        const attempts = row.attempts + 1;
        if (e instanceof DiscordError && e.retryAfterMs) {
          await tx.execute(sql`
            update discord_outbox set next_attempt_at = now() + (${e.retryAfterMs} || ' milliseconds')::interval, last_error = ${err}
            where id = ${row.id}`);
          break; // limit – reszta w następnym przebiegu
        }
        const permanent = e instanceof DiscordError && [400, 401, 403, 404].includes(e.status);
        if (permanent || attempts >= MAX_ATTEMPTS) {
          await tx.execute(sql`update discord_outbox set failed_at = now(), attempts = ${attempts}, last_error = ${err} where id = ${row.id}`);
        } else {
          const backoffSec = 30 * 2 ** attempts;
          await tx.execute(sql`
            update discord_outbox set attempts = ${attempts}, last_error = ${err},
              next_attempt_at = now() + (${backoffSec} || ' seconds')::interval
            where id = ${row.id}`);
        }
      }
    }
  });
  return sent;
}
