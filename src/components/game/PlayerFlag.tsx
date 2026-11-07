import { playerColor } from "@/data/colors";

/**
 * Flaga koloru gracza: grafika z assets/flags/<kolor>.png (red.png / blue.png),
 * w wersji `small` – <kolor>_small.png (red_small.png / blue_small.png).
 * Dopóki grafiki nie wgrano – kwadrat w kolorze gracza.
 */
export function PlayerFlag({
  color,
  flags,
  size = 18,
  small = false,
  className = "",
}: {
  color: string | null | undefined;
  flags?: string[];
  size?: number;
  small?: boolean;
  className?: string;
}) {
  const c = playerColor(color);
  if (!c) return null;
  const file = `${c.slug}${small ? "_small" : ""}.png`;
  if (flags?.includes(file)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/grafika/flags/${file}`} alt={c.name} title={c.name} width={size} height={size} className={`shrink-0 object-contain ${className}`} />;
  }
  return (
    <span
      role="img"
      aria-label={c.name}
      title={c.name}
      className={`inline-block shrink-0 rounded-[2px] border border-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] ${className}`}
      style={{ width: size, height: size, background: c.hex }}
    />
  );
}

/**
 * Małe flagi kolorów gracza w kolejnych grach meczu (jedna flaga na grę).
 * Przed wprowadzeniem wyniku (colors = null) zostaje pusta przestrzeń o szerokości `reserve` flag, żeby wiersze się nie rozjeżdżały.
 */
export function GameFlags({ colors, flags, size = 24, reserve = 0, className = "" }: { colors: string[] | null | undefined; flags?: string[]; size?: number; reserve?: number; className?: string }) {
  const list = colors ?? [];
  if (!list.length) return reserve ? <span className={`shrink-0 ${className}`} style={{ width: reserve * (size + 2) }} aria-hidden /> : null;
  const label = `Kolory w kolejnych grach: ${list.map((c) => playerColor(c)?.name.toLowerCase() ?? c).join(", ")}`;
  return (
    <span className={`flex shrink-0 items-center gap-0.5 ${className}`} title={label} aria-label={label} role="img">
      {list.map((c, i) => (
        <PlayerFlag key={i} color={c} flags={flags} size={size} small />
      ))}
    </span>
  );
}
