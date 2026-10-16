// Uruchamia migracje SQL z katalogu ./drizzle. Używane lokalnie (npm run db:migrate) i przy starcie kontenera.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

try {
  await import("dotenv/config");
} catch {
  // w kontenerze dotenv nie jest potrzebny
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Brak DATABASE_URL");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
  console.log("Migracje wykonane.");
} finally {
  await client.end();
}
