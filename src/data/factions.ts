/**
 * Frakcje Heroes III (SoD + Horn of the Abyss) i domyślne listy bohaterów.
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

type Roster = { might: string[]; magic: string[]; campaign?: string[] };

/** Domyślne pule bohaterów (pierwsza klasa = "might", druga = "magic"). Bohaterowie kampanijni są domyślnie nieaktywni. */
export const DEFAULT_HEROES: Record<FactionSlug, Roster> = {
  castle: {
    might: ["Orrin", "Valeska", "Edric", "Sylvia", "Beatrice", "Lord Haart", "Sorsha", "Christian", "Tyris", "Sir Mullich"],
    magic: ["Rion", "Adela", "Cuthbert", "Adelaide", "Ingham", "Sanya", "Loynis", "Caitlin"],
    campaign: ["Catherine", "Roland"],
  },
  rampart: {
    might: ["Mephala", "Ufretin", "Jenova", "Ryland", "Thorgrim", "Giselle", "Ivor", "Clancy", "Kyrre"],
    magic: ["Coronius", "Uland", "Elleshar", "Gem", "Malcom", "Melodia", "Alagar", "Aeris"],
    campaign: ["Gelu"],
  },
  tower: {
    might: ["Piquedram", "Thane", "Josephine", "Neela", "Torosar", "Fafner", "Rissa", "Iona"],
    magic: ["Astral", "Halon", "Serena", "Daremyth", "Theodorus", "Solmyr", "Cyra", "Aine"],
    campaign: ["Dracon"],
  },
  inferno: {
    might: ["Fiona", "Rashka", "Marius", "Ignatius", "Octavia", "Calh", "Pyre", "Nymus"],
    magic: ["Ayden", "Xyron", "Axsis", "Olema", "Calid", "Ash", "Zydar", "Xarfax"],
    campaign: ["Xeron"],
  },
  necropolis: {
    might: ["Straker", "Vokial", "Moandor", "Charna", "Tamika", "Isra", "Clavius", "Galthran", "Ranloo", "Haart Lich"],
    magic: ["Septienna", "Aislinn", "Sandro", "Nimbus", "Thant", "Xsi", "Vidomina", "Nagash"],
  },
  dungeon: {
    might: ["Lorelei", "Arlach", "Dace", "Ajit", "Damacon", "Gunnar", "Synca", "Shakti"],
    magic: ["Alamar", "Jaegar", "Malekith", "Jeddite", "Geon", "Deemer", "Sephinroth", "Darkstorn"],
    campaign: ["Mutare", "Mutare Drake"],
  },
  stronghold: {
    might: ["Yog", "Gurnisson", "Jabarkas", "Shiva", "Gretchin", "Krellion", "Crag Hack", "Tyraxor"],
    magic: ["Gird", "Vey", "Dessa", "Terek", "Zubin", "Gundula", "Oris", "Saurug"],
    campaign: ["Kilgor", "Boragus"],
  },
  fortress: {
    might: ["Bron", "Drakon", "Wystan", "Tazar", "Alkin", "Korbac", "Gerwulf", "Broghild"],
    magic: ["Mirlanda", "Rosic", "Voy", "Kinkeria", "Verdish", "Merist", "Styg", "Andra", "Tiva"],
    campaign: ["Adrienne"],
  },
  conflux: {
    might: ["Pasis", "Thunar", "Ignissa", "Lacus", "Monere", "Erdamon", "Fiur", "Kalt"],
    magic: ["Luna", "Brissa", "Ciele", "Labetha", "Inteus", "Aenain", "Gelare", "Grindan"],
  },
  cove: {
    might: ["Corkes", "Jeremy", "Illor", "Derek", "Elmore", "Leena", "Anabel", "Cassiopeia", "Miriam", "Bidley", "Tark"],
    magic: ["Casmetra", "Eovacius", "Spint", "Andal", "Manfred", "Zilare", "Astra", "Dargem"],
  },
  factory: {
    might: ["Henrietta", "Sam", "Tancred", "Melchior", "Floribert", "Wynona", "Dury", "Morton", "Murdoch"],
    magic: ["Frederick", "Celestine", "Todd", "Agar", "Bertram", "Wrathmont", "Ziph", "Victoria", "Eanswythe"],
  },
  bulwark: {
    might: ["Dhuin", "Oidana", "Neia", "Eikthurn", "Creyle", "Spadum", "Kynr", "Ergon"],
    magic: ["Kriv", "Glacius", "Sial", "Dalton", "Biarma", "Haugir", "Akka", "Vehr", "Allora"],
  },
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
  const out: HeroSeed[] = [];
  for (const f of FACTION_SLUGS) {
    const r = DEFAULT_HEROES[f];
    for (const name of r.might) out.push({ slug: heroSlug(name), name, faction: f, heroClass: 0, active: true });
    for (const name of r.magic) out.push({ slug: heroSlug(name), name, faction: f, heroClass: 1, active: true });
    for (const name of r.campaign ?? []) out.push({ slug: heroSlug(name), name, faction: f, heroClass: 0, active: false });
  }
  return out;
}
