import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET musi mieć min. 32 znaki"),
  DATABASE_URL: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().default(""),
  DISCORD_CLIENT_SECRET: z.string().default(""),
  DISCORD_BOT_TOKEN: z.string().default(""),
  DISCORD_GUILD_ID: z.string().default(""),
  DISCORD_CHANNEL_ID: z.string().default(""),
  DISCORD_INVITE_URL: z.string().default(""),
  ADMIN_DISCORD_IDS: z.string().default(""),
  DEV_LOGIN: z.string().default("false"),
});

type Env = z.infer<typeof schema> & {
  adminDiscordIds: string[];
  devLoginEnabled: boolean;
  discordBotConfigured: boolean;
};

let cached: Env | null = null;

/** Zmienne środowiskowe walidowane leniwie (żeby `next build` nie wymagał sekretów). */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  cached = {
    ...parsed,
    APP_URL: parsed.APP_URL.replace(/\/$/, ""),
    adminDiscordIds: parsed.ADMIN_DISCORD_IDS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    devLoginEnabled: parsed.NODE_ENV !== "production" && parsed.DEV_LOGIN === "true",
    discordBotConfigured: Boolean(parsed.DISCORD_BOT_TOKEN && parsed.DISCORD_GUILD_ID),
  };
  return cached;
}
