import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { DiscordIcon } from "@/components/ui/icons";
import { getSessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Logowanie" };

const ERRORS: Record<string, string> = {
  stan: "Sesja logowania wygasła lub jest nieprawidłowa. Spróbuj ponownie.",
  discord: "Nie udało się zalogować przez Discord. Spróbuj ponownie za chwilę.",
  ban: "To konto zostało zablokowane.",
  konfiguracja: "Logowanie przez Discord nie jest jeszcze skonfigurowane (brak DISCORD_CLIENT_ID).",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; blad?: string }> }) {
  await connection();
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getSessionUser()) redirect(next);
  const dev = env().devLoginEnabled;

  return (
    <Frame className="mx-auto max-w-md" title="Wejście do turnieju" bodyClassName="p-6 sm:p-8">
      <div className="space-y-6 text-center">
        <p className="text-cream-dim">
          Logowanie odbywa się wyłącznie przez konto <strong className="text-cream">Discord</strong>. Samo zalogowanie nie zapisuje Cię do turnieju – zrobisz to w kolejnym kroku.
        </p>
        {sp.blad && ERRORS[sp.blad] && (
          <p role="alert" className="rounded-sm border border-crimson-light/60 bg-crimson/25 px-3 py-2 text-sm">
            {ERRORS[sp.blad]}
          </p>
        )}
        <a href={`/api/auth/discord?next=${encodeURIComponent(next)}`} className="btn w-full py-3 text-base" style={{ background: "linear-gradient(180deg,#6f7cf0,#5865f2 50%,#3c45a5)", color: "#fff" }}>
          <DiscordIcon size={20} /> Zaloguj przez Discord
        </a>
        <p className="text-xs text-cream-dim">
          Pobieramy tylko Twój identyfikator, nazwę i awatar. Uprawnienie „dołączanie do serwerów” pozwala automatycznie dodać Cię na serwer turnieju przy zapisie.
        </p>
        {dev && (
          <form action="/api/auth/dev" method="get" className="space-y-2 border-t border-gold/20 pt-5 text-left">
            <p className="label">Logowanie testowe (tylko development)</p>
            <input type="hidden" name="next" value={next} />
            <div className="flex gap-2">
              <input name="name" className="input" placeholder="nazwa testowa, np. gracz1" pattern="[a-zA-Z0-9_]{1,24}" required />
              <button className="btn">Wejdź</button>
            </div>
          </form>
        )}
      </div>
    </Frame>
  );
}
