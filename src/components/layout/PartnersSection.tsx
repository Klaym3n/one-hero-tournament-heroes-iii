import type { Partner } from "@/db/schema";
import { DiscordIcon } from "@/components/ui/icons";

function PartnerCard({ p }: { p: Partner }) {
  const body = (
    <>
      <div className="partner-logo frame-xs flex h-16 items-center justify-center p-2">
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

/** Partnerzy turnieju w stopce każdej strony; bez partnerów – zachęta do kontaktu (konfiguracja: Panel → Partnerzy). */
export function PartnersSection({ partners, invite }: { partners: Partner[]; invite?: string }) {
  return (
    <section aria-labelledby="partnerzy" className="mx-auto max-w-6xl border-b border-gold-dark/40 px-4 py-6">
      <h2 id="partnerzy" className="mb-4 text-center text-[11px] tracking-widest text-cream-dim uppercase">
        Partnerzy turnieju
      </h2>
      {partners.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-4">
          {partners.map((p) => (
            <li key={p.id} className="w-[calc(50%-0.5rem)] sm:w-40">
              <PartnerCard p={p} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm text-cream-dim">
          Chcesz wesprzeć One Hero Open jako partner? Odezwij się do Turniejów Orzecha.
          {invite && (
            <a href={invite} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost ml-3 align-middle">
              <DiscordIcon /> Napisz na Discordzie
            </a>
          )}
        </p>
      )}
    </section>
  );
}
