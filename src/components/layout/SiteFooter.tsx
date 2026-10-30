import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { CoffeeIcon, DiscordIcon } from "@/components/ui/icons";

/** Link czytany w czasie żądania – zmienna środowiskowa jest dostępna dopiero w kontenerze. */
async function DiscordLink() {
  await connection();
  const invite = process.env.DISCORD_INVITE_URL;
  if (!invite) return null;
  return (
    <a href={invite} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
      <DiscordIcon /> Discord
    </a>
  );
}

const SUPPORT_URL = "https://buycoffee.to/orzechmc";

export function SiteFooter() {
  return (
    <footer className="leather mt-10 border-t border-black shadow-[0_-1px_0_var(--gold-dark)]">
      {/* organizator i wsparcie */}
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 border-b border-gold-dark/40 px-4 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <span className="text-[11px] tracking-widest text-cream-dim uppercase">Organizator</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/to-logo-poziome.png" alt="Turnieje Orzecha" width={600} height={229} className="h-14 w-auto" />
        </div>
        <div className="flex max-w-md flex-col items-center gap-3 sm:items-end sm:text-right">
          <p className="text-sm text-cream-dim">
            Podoba Ci się <span className="text-cream">One Hero Open</span>? Wesprzyj turniej i kolejne wydarzenia{" "}
            <span className="text-cream">Turniejów Orzecha</span>.
          </p>
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
            <CoffeeIcon /> Postaw kawę
          </a>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-6 text-sm text-cream-dim sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/oho-ikona.png" alt="" width={36} height={36} className="h-9 w-9" />
          <p className="font-display text-xs tracking-wider">One Hero Open · Heroes of Might and Magic III</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/turniej" className="hover:text-gold-light">
            Informacje
          </Link>
          <Link href="/regulamin" className="hover:text-gold-light">
            Regulamin
          </Link>
          <Link href="/polityka-prywatnosci" className="hover:text-gold-light">
            Polityka prywatności
          </Link>
          <Suspense fallback={null}>
            <DiscordLink />
          </Suspense>
        </nav>
      </div>
      <p className="pb-4 text-center text-[11px] text-cream-dim/60">
        Heroes of Might and Magic jest znakiem towarowym należącym do Ubisoft. Serwis fanowski, niezwiązany z wydawcą.
      </p>
    </footer>
  );
}
