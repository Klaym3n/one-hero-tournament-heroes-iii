import { and, eq, gte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { pageViews } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|embed|headless|lighthouse|python|curl|wget/i;
const MOBILE_RE = /mobile|android|iphone|ipad/i;

function warsawDay(d = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(d);
}

/** Zliczanie odwiedzin (wysyłane przez PageViewTracker). Bez ciasteczek: odwiedzający = dzienny skrót IP + przeglądarki. */
export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT_RE.test(ua)) return new NextResponse(null, { status: 204 });

  let body: { path?: unknown; ref?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const path = typeof body.path === "string" ? body.path.split("?")[0].slice(0, 200) : "";
  if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) return new NextResponse(null, { status: 204 });

  let referrer: string | null = null;
  if (typeof body.ref === "string" && body.ref) {
    try {
      const host = new URL(body.ref).hostname.replace(/^www\./, "");
      if (host && host !== new URL(env().APP_URL).hostname.replace(/^www\./, "")) referrer = host.slice(0, 100);
    } catch {
      // nieprawidłowy adres – pomijamy
    }
  }

  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim();
  const day = warsawDay();
  const visitor = sha256(`${day}|${ip}|${ua}|${env().SESSION_SECRET}`).slice(0, 20);
  const user = await getSessionUser();
  const mobile = MOBILE_RE.test(ua);

  try {
    const since = new Date(Date.now() - 24 * 3_600_000);
    const [seen] = await db
      .select({ id: pageViews.id })
      .from(pageViews)
      .where(and(eq(pageViews.visitor, visitor), gte(pageViews.createdAt, since)))
      .limit(1);
    await db.insert(pageViews).values({ path, visitor, userId: user?.id ?? null, referrer, mobile });
    if (!seen) log.info("wizyty", `nowy odwiedzający: ${path}${referrer ? ` (z ${referrer})` : ""}${mobile ? " · telefon" : ""}`, user);
  } catch (e) {
    log.error("wizyty", "nie udało się zapisać wizyty", e);
  }
  return new NextResponse(null, { status: 204 });
}
