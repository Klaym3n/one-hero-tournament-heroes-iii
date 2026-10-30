import type { Partner } from "@/db/schema";
import { DiscordIcon } from "@/components/ui/icons";

const PLACEHOLDER_SLOTS = 4;

function PartnerCard({ p }: { p: Partner }) {
  const body = (
    <>
      <div className="partner-logo frame-xs flex h-24 items-center justify-center p-3">
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logoUrl} alt={p.name} loading="lazy" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="font-display text-lg font-bold text-gold-light">{p.name}</span>
        )}
      </div>
      <div className="mt-2 text-center">
        {p.logoUrl && <p className="text-sm font-semibold text-cream">{p.name}</p>}
        {p.tier && <p className="text-[11px] tracking-widest text-cream-dim uppercase">{p.tier}</p>}
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

/** Pasek partnerów na dole strony głównej; bez partnerów – miejsca zastępcze (konfiguracja: Panel → Partnerzy). */
export function PartnersSection({ partners, invite }: { partners: Partner[]; invite?: string }) {
  return (
    <section aria-labelledby="partnerzy" className="pt-2">
      <h2 id="partnerzy" className="title-gold text-center text-2xl font-black">
        Partnerzy turnieju
      </h2>
      <div className="divider-ornament mx-auto mt-2 mb-6 max-w-xs text-xs" aria-hidden>
        ◆
      </div>
      {partners.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-4">
          {partners.map((p) => (
            <li key={p.id} className="w-[calc(50%-0.5rem)] sm:w-48">
              <PartnerCard p={p} />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: PLACEHOLDER_SLOTS }, (_, i) => (
              <li key={i} className="partner-placeholder flex h-24 items-center justify-center rounded-sm px-3 text-center">
                <span className="font-display text-xs tracking-widest text-cream-dim/70 uppercase">Miejsce dla partnera</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-sm text-cream-dim">
            Chcesz wesprzeć One Hero Open? Odezwij się do Turniejów Orzecha.
            {invite && (
              <a href={invite} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost ml-3 align-middle">
                <DiscordIcon /> Napisz na Discordzie
              </a>
            )}
          </p>
        </>
      )}
    </section>
  );
}
