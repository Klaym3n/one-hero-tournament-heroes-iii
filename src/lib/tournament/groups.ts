import { randomInt } from "node:crypto";

export const MIN_GROUP_SIZE = 4;
export const MAX_GROUP_SIZE = 6;
export const ADVANCE_PER_GROUP = 2;

export type GroupVariant = {
  groupCount: number;
  /** Rozmiary grup w kolejności A, B, C… (większe najpierw) */
  sizes: number[];
  advancing: number;
  /** true gdy rozmiary wychodzą poza zakres 4–6 */
  outOfRange: boolean;
  label: string;
  /** łączna liczba meczów w fazie grupowej */
  matchCount: number;
};

function distribute(n: number, groupCount: number): number[] {
  const base = Math.floor(n / groupCount);
  const extra = n % groupCount;
  return Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0));
}

function describe(sizes: number[]): string {
  const counts = new Map<number, number>();
  for (const s of sizes) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, count]) => `${count}× ${size}-os.`)
    .join(" + ");
}

function polishGroups(n: number): string {
  if (n === 1) return "grupa";
  const mod10 = n % 10;
  const mod100 = n % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "grupy" : "grup";
}

/**
 * Warianty podziału N graczy na grupy tak, by liczba awansujących (2 z grupy) była potęgą 2.
 * Liczba grup = potęga 2. Grupy mogą mieć różne rozmiary (różnica maks. 1).
 * Gdy żaden wariant nie mieści się w zakresie 4–6, zwracane są najbliższe warianty z flagą `outOfRange`.
 */
export function proposeGroupVariants(
  n: number,
  { min = MIN_GROUP_SIZE, max = MAX_GROUP_SIZE }: { min?: number; max?: number } = {},
): GroupVariant[] {
  if (n < 2) return [];
  const all: GroupVariant[] = [];
  for (let g = 1; g <= n / 2; g *= 2) {
    const sizes = distribute(n, g);
    const smallest = sizes[sizes.length - 1];
    if (smallest < 2) break;
    const outOfRange = smallest < min || sizes[0] > max;
    const matchCount = sizes.reduce((acc, s) => acc + (s * (s - 1)) / 2, 0);
    all.push({
      groupCount: g,
      sizes,
      advancing: g * ADVANCE_PER_GROUP,
      outOfRange,
      matchCount,
      label: `${g} ${polishGroups(g)}: ${describe(sizes)} → ${g * ADVANCE_PER_GROUP} graczy w pucharze`,
    });
  }
  const valid = all.filter((v) => !v.outOfRange);
  if (valid.length > 0) return valid;
  // brak idealnego wariantu – podaj 2 najbliższe (najmniejsze odchylenie od zakresu)
  const distance = (v: GroupVariant) =>
    Math.max(0, min - v.sizes[v.sizes.length - 1]) + Math.max(0, v.sizes[0] - max);
  return [...all].sort((a, b) => distance(a) - distance(b)).slice(0, 2);
}

export function groupName(index: number): string {
  let name = "";
  let i = index;
  do {
    name = String.fromCharCode(65 + (i % 26)) + name;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return name;
}

export type Rng = (maxExclusive: number) => number;
export const cryptoRng: Rng = (max) => randomInt(max);

export function shuffle<T>(items: readonly T[], rng: Rng = cryptoRng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** W pełni losowy przydział graczy do grup o zadanych rozmiarach. */
export function drawGroups<T>(players: readonly T[], sizes: number[], rng: Rng = cryptoRng): T[][] {
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total !== players.length) throw new Error("Suma rozmiarów grup nie zgadza się z liczbą graczy");
  const shuffled = shuffle(players, rng);
  const out: T[][] = [];
  let k = 0;
  for (const size of sizes) {
    out.push(shuffled.slice(k, k + size));
    k += size;
  }
  return out;
}

/**
 * Terminarz "każdy z każdym" metodą kołową. Zwraca kolejki (rundy) par indeksów.
 */
export function roundRobin(size: number): [number, number][][] {
  const ids = Array.from({ length: size }, (_, i) => i);
  if (size % 2 === 1) ids.push(-1); // pauza
  const n = ids.length;
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i];
      const b = ids[n - 1 - i];
      if (a !== -1 && b !== -1) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // rotacja wszystkich poza pierwszym
    ids.splice(1, 0, ids.pop()!);
  }
  return rounds;
}
