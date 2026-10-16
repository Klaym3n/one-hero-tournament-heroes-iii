import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { DiscordIcon } from "@/components/ui/icons";

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

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-black bg-[linear-gradient(180deg,#1a130a,#0c0a06)] shadow-[0_-1px_0_var(--gold-dark)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-6 text-sm text-cream-dim sm:flex-row sm:justify-between">
        <p className="font-display text-xs tracking-wider">Turniej One Hero · Heroes of Might and Magic III</p>
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
