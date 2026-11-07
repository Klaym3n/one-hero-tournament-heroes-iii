import type { Partner } from "@/db/schema";
import { DiscordIcon } from "@/components/ui/icons";

function PartnerCard({ p }: { p: Partner }) {
  const body = (
    <>
      <div className="partner-logo frame-xs flex h-24 items-center justify-center p-1.5">
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logoUrl} alt={p.name} loading="lazy" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="font-display text-sm font-bold text-gold-light">{p.name}</span>
        )}
      </div>
      <div className="mt-1.5 text-center">
        {p.logoUrl && <p className="text-xs font-semibold text-cream">{p.name}</p>}
        {p.tier && <p className="text-[10px] tracking-widest text-cream-dim uppercase">{p.tier}</p>}
      </div>
    </>
  );
  return p.url ? (
    <a href={p.url} target="_blank" rel="noopener noreferrer sponsored" className="partner-card block">
      {body}
    </a>
  ) : (
    <div>{body}</div>
  );
}

/** Partnerzy turnieju w stopce (obok organizatora); bez partnerów – zachęta do kontaktu (konfiguracja: Panel → Partnerzy). */
export function PartnersSection({ partners, invite }: { partners: Partner[]; invite?: string }) {
  return (
    <section aria-labelledby="partnerzy" className="flex w-full min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
      <h2 id="partnerzy" className="text-[11px] tracking-widest text-cream-dim uppercase">
        Partnerzy turnieju
      </h2>
      {partners.length > 0 ? (
        <ul className="flex w-full flex-wrap justify-center gap-4 sm:justify-start">
          {partners.map((p) => (
            // karty dzielą dostępne miejsce (min. 9rem) – dopiero przy braku miejsca przechodzą do kolejnej linii
            <li key={p.id} className="w-[calc(50%-0.5rem)] sm:w-auto sm:max-w-52 sm:min-w-36 sm:flex-1">
              <PartnerCard p={p} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="max-w-xs text-sm text-cream-dim">
          Chcesz wesprzeć One Hero Open jako partner?
          {invite && (
            <a href={invite} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost mt-2 flex w-fit">
              <DiscordIcon /> Napisz na Discordzie
            </a>
          )}
        </p>
      )}
    </section>
  );
}
