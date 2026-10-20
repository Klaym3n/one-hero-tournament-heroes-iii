import { FACTION_BY_SLUG, type FactionSlug } from "@/data/factions";

type Props = { slug: string; name: string; faction: string; hasImage?: boolean; size?: number; className?: string };

/** Portret bohatera: public/assets/heroes/<slug>.png lub placeholder z inicjałami. */
export function HeroPortrait({ slug, name, faction, hasImage, size = 48, className = "" }: Props) {
  const style = { width: size, height: Math.round(size * 1.1) };
  if (hasImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/grafika/heroes/${slug}.png`} alt={name} style={style} className={`frame-xs object-cover ${className}`} />;
  }
  const color = FACTION_BY_SLUG[faction as FactionSlug]?.color ?? "#555";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      style={{ ...style, background: `linear-gradient(160deg, ${color}, #0b0912 85%)` }}
      className={`frame-xs inline-flex items-center justify-center font-display font-bold text-gold-light ${className}`}
      aria-label={name}
      title={name}
    >
      <span style={{ fontSize: size * 0.34 }}>{initials}</span>
    </span>
  );
}
