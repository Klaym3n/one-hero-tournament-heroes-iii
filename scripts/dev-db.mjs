// Lokalny PostgreSQL do developmentu (bez Dockera). Uruchom: npm run db:local
// Dane trzymane w .pgdata/, port 5433, użytkownik/hasło: postgres/postgres, baza: homm3.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dataDir = new URL("../.pgdata", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const port = Number(process.env.LOCAL_PG_PORT ?? 5433);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  // bez tego Windows tworzy klaster w kodowaniu WIN1250, które nie obsługuje m.in. emoji
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const fresh = !existsSync(dataDir);
if (fresh) await pg.initialise();
await pg.start();
for (const db of ["homm3", "homm3_test"]) {
  try {
    await pg.createDatabase(db);
  } catch {
    // baza już istnieje
  }
}
console.log(`PostgreSQL działa: postgres://postgres:postgres@localhost:${port}/homm3 (Ctrl+C aby zatrzymać)`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
