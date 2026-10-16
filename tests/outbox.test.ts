/**
 * Kolejka wiadomości Discord: DM, fallback na kanał przy zablokowanych DM, limit zapytań, błędy trwałe.
 * API Discorda jest zamockowane (global fetch). Wymaga bazy testowej jak flow.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/homm3_test";
process.env.DATABASE_URL = TEST_URL;
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.DISCORD_BOT_TOKEN = "bot-token";
process.env.DISCORD_GUILD_ID = "1";
process.env.DISCORD_CHANNEL_ID = "999";

let reachable = true;
type Call = { url: string; body: Record<string, unknown> };
const calls: Call[] = [];
let blockDmFor = new Set<string>();
let rateLimitOnce = false;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeAll(async () => {
  const sql = postgres(TEST_URL, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade;");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  } catch {
    reachable = false;
  }
  await sql.end();

  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url, body });
    if (rateLimitOnce) {
      rateLimitOnce = false;
      return json(429, { message: "You are being rate limited.", retry_after: 0.5 });
    }
    if (url.endsWith("/users/@me/channels")) return json(200, { id: `dm-${body.recipient_id}` });
    const dm = /channels\/dm-(\d+)\/messages$/.exec(url);
    if (dm && blockDmFor.has(dm[1])) return json(403, { message: "Cannot send messages to this user", code: 50007 });
    if (url.includes("/channels/404/")) return json(404, { message: "Unknown Channel", code: 10003 });
    return json(200, { id: "msg" });
  });
});

afterAll(() => vi.unstubAllGlobals());

describe("discord outbox", () => {
  it("DM, fallback na kanał, limit i błąd trwały", async () => {
    if (!reachable) return console.warn("Pominięto: brak bazy testowej");
    const { db } = await import("@/db");
    const S = await import("@/db/schema");
    const { notifyUsers } = await import("@/lib/notify");
    const { processOutbox } = await import("@/lib/discord/outbox");
    const { eq } = await import("drizzle-orm");

    const [a] = await db.insert(S.users).values({ discordId: "111", discordUsername: "a" }).returning();
    const [b] = await db.insert(S.users).values({ discordId: "222", discordUsername: "b" }).returning();
    const [dev] = await db.insert(S.users).values({ discordId: "dev-x", discordUsername: "x" }).returning();
    blockDmFor = new Set(["222"]);

    await notifyUsers([a.id, b.id, dev.id], { type: "T", title: "Potwierdź wynik", body: "Opis", href: "/mecze/1" });
    // powiadomienia w serwisie dla wszystkich, DM tylko dla prawdziwych kont Discord
    expect((await db.select().from(S.notifications)).length).toBe(3);
    expect((await db.select().from(S.discordOutbox)).length).toBe(2);

    await db.insert(S.discordOutbox).values({ kind: "CHANNEL", target: "404", content: "zły kanał" });

    const sent = await processOutbox();
    expect(sent).toBe(2);
    // gracz B ma zablokowane DM → wiadomość na kanale 999 z oznaczeniem
    const fallback = calls.find((c) => c.url.endsWith("/channels/999/messages"));
    expect(fallback?.body.content).toContain("<@222>");
    expect(fallback?.body.allowed_mentions).toEqual({ users: ["222"] });
    // nieistniejący kanał → błąd trwały, bez ponawiania
    const [bad] = await db.select().from(S.discordOutbox).where(eq(S.discordOutbox.target, "404"));
    expect(bad.failedAt).not.toBeNull();

    // limit zapytań: wiadomość czeka na kolejną próbę
    await db.insert(S.discordOutbox).values({ kind: "CHANNEL", target: "999", content: "runda" });
    rateLimitOnce = true;
    expect(await processOutbox()).toBe(0);
    const [limited] = await db.select().from(S.discordOutbox).where(eq(S.discordOutbox.content, "runda"));
    expect(limited.sentAt).toBeNull();
    expect(limited.failedAt).toBeNull();
    expect(limited.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("dzieli długie ogłoszenia na części < 2000 znaków", async () => {
    const { splitMessage } = await import("@/lib/discord/api");
    const lines = Array.from({ length: 120 }, (_, i) => `• <@${100000000000000000 + i}> vs <@${200000000000000000 + i}> – https://turniej.example.com/mecze/${i}`);
    const parts = splitMessage(lines.join("\n"));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length < 2000)).toBe(true);
    expect(parts.join("\n")).toBe(lines.join("\n"));
  });
});
