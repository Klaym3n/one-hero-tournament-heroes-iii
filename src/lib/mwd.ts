/**
 * Dzień gry w formacie Heroes III: Miesiąc–Tydzień–Dzień (MWD).
 * Kod 111 = miesiąc 1, tydzień 1, dzień 1 = indeks 1; 127 = indeks 14; 211 = indeks 29.
 * W bazie przechowujemy indeks dnia (liczba całkowita od 1).
 */

export type MWD = { month: number; week: number; day: number };

export const MAX_MONTH = 99;

export function isValidMWD({ month, week, day }: MWD): boolean {
  return (
    Number.isInteger(month) &&
    Number.isInteger(week) &&
    Number.isInteger(day) &&
    month >= 1 &&
    month <= MAX_MONTH &&
    week >= 1 &&
    week <= 4 &&
    day >= 1 &&
    day <= 7
  );
}

export function mwdToIndex(m: MWD): number {
  if (!isValidMWD(m)) throw new Error("Nieprawidłowy dzień MWD");
  return (m.month - 1) * 28 + (m.week - 1) * 7 + m.day;
}

export function indexToMwd(index: number): MWD {
  if (!Number.isInteger(index) || index < 1 || index > MAX_MONTH * 28) throw new Error("Nieprawidłowy indeks dnia");
  const i = index - 1;
  return { month: Math.floor(i / 28) + 1, week: Math.floor((i % 28) / 7) + 1, day: (i % 7) + 1 };
}

/** Kod liczbowy, np. 142. */
export function mwdCode(m: MWD): number {
  return m.month * 100 + m.week * 10 + m.day;
}

export function parseMwdCode(code: number): MWD | null {
  if (!Number.isInteger(code) || code < 111) return null;
  const m = { month: Math.floor(code / 100), week: Math.floor(code / 10) % 10, day: code % 10 };
  return isValidMWD(m) ? m : null;
}

export function indexToCode(index: number): number {
  return mwdCode(indexToMwd(index));
}

export function codeToIndex(code: number): number | null {
  const m = parseMwdCode(code);
  return m ? mwdToIndex(m) : null;
}

export function formatDay(index: number): string {
  const m = indexToMwd(index);
  return `${mwdCode(m)} (M${m.month} T${m.week} D${m.day})`;
}
