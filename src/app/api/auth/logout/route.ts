import { NextResponse } from "next/server";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { log } from "@/lib/log";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const base = env().APP_URL;
  // ochrona przed wylogowaniem z obcej strony (CSRF)
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(base).origin) return new NextResponse("Forbidden", { status: 403 });
  const user = await getSessionUser();
  await destroySession();
  if (user) log.info("auth", "wylogował(a) się", user);
  return NextResponse.redirect(new URL("/", base), { status: 303 });
}
