/**
 * Kolory graczy w turnieju – gra się tylko czerwonym i niebieskim,
 * więc wybór koloru jednego gracza wyznacza kolor drugiego.
 */
export type PlayerColorSlug = "red" | "blue";

export type PlayerColor = { slug: PlayerColorSlug; name: string; hex: string };

export const PLAYER_COLORS: PlayerColor[] = [
  { slug: "red", name: "Czerwony", hex: "#c43a2f" },
  { slug: "blue", name: "Niebieski", hex: "#3a64c4" },
];

export const PLAYER_COLOR_SLUGS = ["red", "blue"] as const satisfies readonly PlayerColorSlug[];

export function oppositeColor(c: PlayerColorSlug): PlayerColorSlug {
  return c === "red" ? "blue" : "red";
}

const BY_SLUG = Object.fromEntries(PLAYER_COLORS.map((c) => [c.slug, c])) as Record<PlayerColorSlug, PlayerColor>;

export function playerColor(slug: string | null | undefined): PlayerColor | null {
  return slug && slug in BY_SLUG ? BY_SLUG[slug as PlayerColorSlug] : null;
}
