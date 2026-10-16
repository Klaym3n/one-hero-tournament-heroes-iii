export type Interval = { start: number; end: number }; // ms UTC, [start, end)

export const SLOT_MINUTES = 30;
export const SLOT_MS = SLOT_MINUTES * 60_000;

/** Sortuje i scala nakładające się / stykające przedziały. */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** Część wspólna dwóch list przedziałów. */
export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const x = mergeIntervals(a);
  const y = mergeIntervals(b);
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    const start = Math.max(x[i].start, y[j].start);
    const end = Math.min(x[i].end, y[j].end);
    if (end > start) out.push({ start, end });
    if (x[i].end < y[j].end) i++;
    else j++;
  }
  return out;
}

/**
 * Wspólne terminy dwóch graczy: przecięcia dostępności o długości ≥ minMinutes,
 * zaczynające się po `now` (początek przycinany do teraz), najwcześniejsze najpierw.
 */
export function commonSlots(
  a: Interval[],
  b: Interval[],
  { minMinutes, now, limit = 5 }: { minMinutes: number; now: number; limit?: number },
): Interval[] {
  const minMs = minMinutes * 60_000;
  // początek zaokrąglony w górę do pełnego półgodzinnego slotu
  const from = Math.ceil(now / SLOT_MS) * SLOT_MS;
  return intersect(a, b)
    .map((i) => ({ start: Math.max(i.start, from), end: i.end }))
    .filter((i) => i.end - i.start >= minMs)
    .slice(0, limit);
}
