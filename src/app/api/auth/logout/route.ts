import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const base = env().APP_URL;
  // ochrona przed wylogowaniem z obcej strony (CSRF)
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(base).origin) return new NextResponse("Forbidden", { status: 403 });
  await destroySession();
  return NextResponse.redirect(new URL("/", base), { status: 303 });
}
