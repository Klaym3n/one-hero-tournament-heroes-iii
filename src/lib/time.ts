import { TZDate } from "@date-fns/tz";

export const TZ = "Europe/Warsaw";

/** "2026-10-20T19:30" (czas polski) → Date (UTC). */
export function parseWarsawLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const dt = new TZDate(y, mo - 1, d, h, mi, TZ);
  return Number.isNaN(dt.getTime()) ? null : new Date(dt.getTime());
}

/** Date → "2026-10-20T19:30" w czasie polskim (dla <input type="datetime-local">). */
export function toWarsawLocal(date: Date | string | number): string {
  const d = new TZDate(new Date(date).getTime(), TZ);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Poniedziałek 00:00 czasu polskiego dla tygodnia zawierającego datę. */
export function weekStartWarsaw(date: Date | number): TZDate {
  const d = new TZDate(new Date(date).getTime(), TZ);
  const dow = (d.getDay() + 6) % 7; // 0 = poniedziałek
  return new TZDate(d.getFullYear(), d.getMonth(), d.getDate() - dow, 0, 0, TZ);
}

export function addDaysWarsaw(start: TZDate, days: number, hour = 0, minute = 0): TZDate {
  return new TZDate(start.getFullYear(), start.getMonth(), start.getDate() + days, hour, minute, TZ);
}
