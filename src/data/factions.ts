/**
 * Frakcje Heroes III (SoD + Horn of the Abyss) i turniejowa pula bohaterów.
 * Bohaterowie są wgrywani do bazy (tabela `heroes`) i mogą być edytowani w panelu admina.
 * Grafiki: public/assets/factions/<slug>.png oraz public/assets/heroes/<heroSlug>.png
 */

export type FactionSlug =
  | "castle"
  | "rampart"
  | "tower"
  | "inferno"
  | "necropolis"
  | "dungeon"
  | "stronghold"
  | "fortress"
  | "conflux"
  | "cove"
  | "factory"
  | "bulwark";

export type Faction = {
  slug: FactionSlug;
  name: string; // nazwa polska
  nameEn: string;
  color: string; // kolor placeholdera herbu
  classes: [string, string];
  hota?: boolean;
};

export const FACTIONS: Faction[] = [
  { slug: "castle", name: "Zamek", nameEn: "Castle", color: "#3E6FB8", classes: ["Rycerz", "Kleryk"] },
  { slug: "rampart", name: "Bastion", nameEn: "Rampart", color: "#3C8A45", classes: ["Łowca", "Druid"] },
  { slug: "tower", name: "Forteca", nameEn: "Tower", color: "#9DB7C9", classes: ["Alchemik", "Czarodziej"] },
  { slug: "inferno", name: "Inferno", nameEn: "Inferno", color: "#C2361F", classes: ["Demoniak", "Heretyk"] },
  { slug: "necropolis", name: "Nekropolis", nameEn: "Necropolis", color: "#5E5A6E", classes: ["Rycerz śmierci", "Nekromanta"] },
  { slug: "dungeon", name: "Lochy", nameEn: "Dungeon", color: "#7A3E9D", classes: ["Władca", "Czarnoksiężnik"] },
  { slug: "stronghold", name: "Twierdza", nameEn: "Stronghold", color: "#B8702A", classes: ["Barbarzyńca", "Mag bitewny"] },
  { slug: "fortress", name: "Cytadela", nameEn: "Fortress", color: "#5F7A36", classes: ["Pan bestii", "Wiedźma"] },
  { slug: "conflux", name: "Wrota Żywiołów", nameEn: "Conflux", color: "#D9A23B", classes: ["Wędrowiec", "Elementalista"] },
  { slug: "cove", name: "Przystań", nameEn: "Cove", color: "#2F8C8C", classes: ["Kapitan", "Nawigator"], hota: true },
  { slug: "factory", name: "Fabryka", nameEn: "Factory", color: "#8C6A4A", classes: ["Najemnik", "Wynalazca"], hota: true },
  { slug: "bulwark", name: "Bulwark", nameEn: "Bulwark", color: "#7E95A8", classes: ["Wódz", "Starszy"], hota: true },
];

export const FACTION_BY_SLUG = Object.fromEntries(FACTIONS.map((f) => [f.slug, f])) as Record<FactionSlug, Faction>;
export const FACTION_SLUGS = FACTIONS.map((f) => f.slug) as FactionSlug[];

export function isFactionSlug(v: string): v is FactionSlug {
  return v in FACTION_BY_SLUG;
}

type HeroDef = { name: string; specialty: string; magic?: boolean };

/**
 * Turniejowa pula bohaterów – jedyni bohaterowie dostępni w każdej frakcji.
 * `magic` = druga klasa frakcji (np. Kleryk), w przeciwnym razie pierwsza (np. Rycerz).
 */
export const DEFAULT_HEROES: Record<FactionSlug, HeroDef[]> = {
  castle: [
    { name: "Tyris", specialty: "Cavaliers" },
    { name: "Loynis", specialty: "Prayer", magic: true },
    { name: "Sir Mullich", specialty: "Speed" },
    { name: "Beatrice", specialty: "Scouting" },
  ],
  rampart: [
    { name: "Mephala", specialty: "Armorer" },
    { name: "Clancy", specialty: "Unicorns" },
    { name: "Kyrre", specialty: "Logistics" },
    { name: "Gelu", specialty: "Sharpshooters" },
  ],
  tower: [
    { name: "Piquedram", specialty: "Gargoyles" },
    { name: "Thane", specialty: "Genies" },
    { name: "Neela", specialty: "Armorer" },
    { name: "Dracon", specialty: "Enchanters", magic: true },
  ],
  inferno: [
    { name: "Fiona", specialty: "Hell Hounds" },
    { name: "Marius", specialty: "Demons" },
    { name: "Calh", specialty: "Gogs" },
    { name: "Xeron", specialty: "Devils" },
  ],
  necropolis: [
    { name: "Galthran", specialty: "Skeletons" },
    { name: "Thant", specialty: "Animate Dead", magic: true },
    { name: "Haart Lich", specialty: "Black Knights" },
  ],
  dungeon: [
    { name: "Gunnar", specialty: "Logistics" },
    { name: "Jeddite", specialty: "Resurrection", magic: true },
    { name: "Mutare Drake", specialty: "Dragons" },
  ],
  stronghold: [
    { name: "Shiva", specialty: "Rocs" },
    { name: "Crag Hack", specialty: "Offense" },
    { name: "Dessa", specialty: "Logistics", magic: true },
    { name: "Gundula", specialty: "Offense", magic: true },
    { name: "Kilgor", specialty: "Behemoths" },
  ],
  fortress: [
    { name: "Drakon", specialty: "Gnolls" },
    { name: "Tazar", specialty: "Armorer" },
    { name: "Broghild", specialty: "Wyverns" },
  ],
  conflux: [
    { name: "Monere", specialty: "Psychic Elementals" },
    { name: "Grindan", specialty: "+350 Gold", magic: true },
  ],
  cove: [
    { name: "Corkes", specialty: "Offense" },
    { name: "Cassiopeia", specialty: "Nymphs" },
    { name: "Miriam", specialty: "Scouting" },
    { name: "Tark", specialty: "Nix" },
  ],
  factory: [
    { name: "Dury", specialty: "Armorer" },
    { name: "Frederick", specialty: "Automatons", magic: true },
    { name: "Tavin", specialty: "Offense" },
    { name: "Murdoch", specialty: "Archery" },
  ],
  bulwark: [
    { name: "Eikthurn", specialty: "Mountain Rams" },
    { name: "Creyle", specialty: "Mammoths" },
    { name: "Ergon", specialty: "Pathfinding" },
    { name: "Dalton", specialty: "Shield", magic: true },
  ],
};

export function heroSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type HeroSeed = { slug: string; name: string; faction: FactionSlug; heroClass: 0 | 1; active: boolean };

export function defaultHeroSeeds(): HeroSeed[] {
  return FACTION_SLUGS.flatMap((f) =>
    DEFAULT_HEROES[f].map((h): HeroSeed => ({ slug: heroSlug(h.name), name: h.name, faction: f, heroClass: h.magic ? 1 : 0, active: true })),
  );
}
