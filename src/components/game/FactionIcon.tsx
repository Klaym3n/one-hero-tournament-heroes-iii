import { FACTION_BY_SLUG, type FactionSlug } from "@/data/factions";

type Props = { slug: string; hasImage?: boolean; size?: number; className?: string; title?: boolean };

/** Herb frakcji: grafika z public/assets/factions/<slug>.png lub placeholder w kolorze frakcji. */
export function FactionIcon({ slug, hasImage, size = 40, className = "", title = true }: Props) {
  const f = FACTION_BY_SLUG[slug as FactionSlug];
  const name = f?.name ?? slug;
  if (hasImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/grafika/factions/${slug}.png`} alt={name} title={title ? name : undefined} width={size} height={size} className={`object-contain ${className}`} />;
  }
  const color = f?.color ?? "#777";
  const words = name.split(/s+/);
  const letter = words.length > 1 ? words.map((w) => w[0]).join("").toUpperCase() : name.slice(0, 2);
  return (
    <svg viewBox="0 0 40 44" width={size} height={size * 1.1} className={className} role="img" aria-label={name}>
      {title && <title>{name}</title>}
      <defs>
        <linearGradient id={`fg-${slug}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path d="M3 3h34v20c0 10-8 16-17 19C11 39 3 33 3 23z" fill={`url(#fg-${slug})`} stroke="#d4af37" strokeWidth="2" />
      <path d="M3 3h34v20c0 10-8 16-17 19C11 39 3 33 3 23z" fill="none" stroke="#000" strokeWidth="0.8" />
      <text x="20" y="27" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="900" fontSize="14" fill="#fff3c4" stroke="#000" strokeWidth="0.6">
        {letter}
      </text>
    </svg>
  );
}
