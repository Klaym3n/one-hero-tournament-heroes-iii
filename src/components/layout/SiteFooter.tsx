import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { CoffeeIcon, DiscordIcon } from "@/components/ui/icons";
import { PartnersSection } from "@/components/layout/PartnersSection";
import { getPartners, getTournament } from "@/lib/tournament/current";
import { log } from "@/lib/log";

async function FooterPartners() {
  await connection();
  let partners;
  try {
    partners = await getPartners((await getTournament()).id);
  } catch (e) {
    // stopka nie może wywrócić strony (np. strony błędu przy niedostępnej bazie)
    log.error("stopka", "nie udało się wczytać partnerów", e);
    return null;
  }
  return <PartnersSection partners={partners} invite={process.env.DISCORD_INVITE_URL || undefined} />;
}

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
      {/* organizator, partnerzy i wsparcie */}
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 border-b border-gold-dark/40 px-4 py-6 text-center lg:flex-row lg:items-start lg:justify-between lg:text-left">
        <div className="flex w-full min-w-0 flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10 lg:flex-1">
          <div className="flex shrink-0 flex-col items-center gap-2 sm:items-start">
            <span className="text-[11px] tracking-widest text-cream-dim uppercase">Organizator</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/to-logo-poziome.png" alt="Turnieje Orzecha" width={600} height={229} className="h-14 w-auto" />
          </div>
          <Suspense fallback={null}>
            <FooterPartners />
          </Suspense>
        </div>
        <div className="flex max-w-xs shrink-0 flex-col items-center gap-3 lg:w-52 lg:items-end lg:text-right">
          <p className="text-sm text-cream-dim">
            Podoba Ci się <span className="text-cream">One Hero Open</span>? Wesprzyj <span className="text-cream">Turnieje Orzecha</span>.
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
    </footer>
  );
}
