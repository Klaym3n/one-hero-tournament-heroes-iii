/**
 * Dane demonstracyjne (TYLKO development): npm run db:seed -- --players=24 [--bracket]
 * Tworzy graczy testowych, losuje grupy, rozgrywa część meczów (raporty + akceptacje, jeden spór).
 * Logika jest wspólna z przyciskiem „Wczytaj dane demo” w panelu (src/server/demo.ts).
 * Zaloguj się jako admin przez /api/auth/dev?name=admin (wymaga DEV_LOGIN=true).
 */
import "dotenv/config";

if (process.env.NODE_ENV === "production") {
  console.error("Seed demo jest zablokowany w produkcji. Na serwerze testowym użyj przycisku w panelu (ALLOW_DEMO_DATA=true).");
  process.exit(1);
}

const arg = (name: string, def: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const { db } = await import("../src/db");
  const S = await import("../src/db/schema");
  const { seedDemo } = await import("../src/server/demo");

  // administrator i moderator demo
  const [admin] = await db
    .insert(S.users)
    .values({ discordId: "dev-admin", discordUsername: "admin", discordGlobalName: "Admin", role: "ADMIN" })
    .onConflictDoUpdate({ target: S.users.discordId, set: { role: "ADMIN" } })
    .returning();
  await db
    .insert(S.users)
    .values({ discordId: "dev-moderator", discordUsername: "moderator", discordGlobalName: "Moderator", role: "MODERATOR" })
    .onConflictDoNothing();

  console.log(await seedDemo(admin, { players: Number(arg("players", "24")), bracket: flag("bracket") }));
  console.log("Gotowe. Zaloguj się: /api/auth/dev?name=admin (admin) lub ?name=demo0 (gracz).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
