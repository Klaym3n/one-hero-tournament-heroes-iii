import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DBOrTx = DB | Tx;

const globalForDb = globalThis as unknown as {
  __pgClient?: postgres.Sql;
  __db?: DB;
};

function create(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Brak DATABASE_URL");
  const client = postgres(url, { max: 10, onnotice: () => {} });
  globalForDb.__pgClient = client;
  return drizzle(client, { schema });
}

/** Leniwie tworzony klient – import modułu nie łączy się z bazą (ważne przy `next build`). */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    globalForDb.__db ??= create();
    return Reflect.get(globalForDb.__db, prop, globalForDb.__db);
  },
});

export function pgClient(): postgres.Sql {
  globalForDb.__db ??= create();
  return globalForDb.__pgClient!;
}

export { schema };
