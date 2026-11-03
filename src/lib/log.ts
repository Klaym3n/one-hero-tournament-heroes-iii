import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Dziennik zdarzeń serwisu: konsola (widoczna w panelu Pterodactyl) + plik na każdy dzień
 * (`LOG_DIR/RRRR-MM-DD.log`). Bez LOG_DIR w produkcji – tylko konsola.
 */

type Who = { discordUsername: string; discordGlobalName?: string | null } | string | null | undefined;

const g = globalThis as unknown as { __logQueue?: Promise<void>; __logDirReady?: string };

function logDir(): string | null {
  if (process.env.LOG_DIR) return process.env.LOG_DIR;
  return process.env.NODE_ENV === "production" ? null : path.join(process.cwd(), "logs");
}

const stamp = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function writeFile(day: string, line: string) {
  const dir = logDir();
  if (!dir) return;
  g.__logQueue = (g.__logQueue ?? Promise.resolve())
    .then(async () => {
      if (g.__logDirReady !== dir) {
        await mkdir(dir, { recursive: true });
        g.__logDirReady = dir;
      }
      await appendFile(path.join(dir, `${day}.log`), line + "\n", "utf8");
    })
    .catch((e) => console.error("[log] nie udało się zapisać pliku dziennika", e));
}

function whoLabel(who: Who): string {
  if (!who) return "";
  if (typeof who === "string") return who;
  return who.discordGlobalName && who.discordGlobalName !== who.discordUsername ? `${who.discordUsername} (${who.discordGlobalName})` : who.discordUsername;
}

function emit(level: "info" | "warn" | "error", scope: string, message: string, who?: Who, err?: unknown) {
  const ts = stamp.format(new Date());
  const actor = whoLabel(who);
  let line = `${ts} ${level === "info" ? "" : `${level.toUpperCase()} `}[${scope}] ${actor ? `${actor}: ` : ""}${message}`;
  if (err !== undefined) line += ` – ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  writeFile(ts.slice(0, 10), line);
}

export const log = {
  info: (scope: string, message: string, who?: Who) => emit("info", scope, message, who),
  warn: (scope: string, message: string, who?: Who, err?: unknown) => emit("warn", scope, message, who, err),
  error: (scope: string, message: string, err?: unknown, who?: Who) => emit("error", scope, message, who, err),
};
