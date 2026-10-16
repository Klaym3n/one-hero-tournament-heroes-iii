// Czyści bazę i wykonuje migracje od nowa (TYLKO development): npm run db:reset
import "dotenv/config";
import postgres from "postgres";

if (process.env.NODE_ENV === "production") {
  console.error("Reset bazy jest zablokowany w produkcji.");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!/localhost|127\.0\.0\.1/.test(url ?? "")) {
  console.error("Reset dozwolony tylko dla lokalnej bazy (localhost).");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe("drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade;");
await sql.end();
console.log("Baza wyczyszczona.");
await import("./migrate.mjs");
