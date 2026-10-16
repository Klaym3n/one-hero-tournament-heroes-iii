import "server-only";
import { EventEmitter } from "node:events";
import { sql } from "drizzle-orm";
import { db, pgClient, type DBOrTx } from "@/db";

export const CHANNEL = "tournament_events";

/** Tematy: "groups", "bracket", "matches", "match:<id>", "user:<id>", "players", "content" */
export async function publish(topics: string[], tx: DBOrTx = db) {
  const payload = JSON.stringify([...new Set(topics)]);
  await tx.execute(sql`select pg_notify(${CHANNEL}, ${payload})`);
}

const g = globalThis as unknown as { __liveBus?: EventEmitter; __liveListening?: Promise<unknown> };

/** Wspólna (na proces) subskrypcja LISTEN rozsyłana do połączeń SSE. */
export function liveBus(): EventEmitter {
  if (!g.__liveBus) {
    g.__liveBus = new EventEmitter();
    g.__liveBus.setMaxListeners(0);
  }
  if (!g.__liveListening) {
    const bus = g.__liveBus;
    g.__liveListening = pgClient()
      .listen(CHANNEL, (payload) => {
        try {
          bus.emit("event", JSON.parse(payload) as string[]);
        } catch {
          // ignoruj nieprawidłowe wiadomości
        }
      })
      .catch((e) => {
        console.error("[realtime] LISTEN failed", e);
        g.__liveListening = undefined;
      });
  }
  return g.__liveBus;
}
