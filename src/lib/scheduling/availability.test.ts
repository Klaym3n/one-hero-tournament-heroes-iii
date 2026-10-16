import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import { commonSlots, intersect, mergeIntervals } from "./availability";

const H = 3_600_000;
const iv = (s: number, e: number) => ({ start: s * H, end: e * H });

describe("availability", () => {
  it("scala stykające się przedziały", () => {
    expect(mergeIntervals([iv(2, 3), iv(0, 1), iv(1, 2)])).toEqual([iv(0, 3)]);
  });

  it("przecina listy", () => {
    expect(intersect([iv(0, 4), iv(6, 10)], [iv(3, 7), iv(9, 12)])).toEqual([iv(3, 4), iv(6, 7), iv(9, 10)]);
  });

  it("wspólne terminy ≥ min. długości, od najwcześniejszego, po teraz", () => {
    const slots = commonSlots([iv(0, 4), iv(10, 14)], [iv(1, 3.5), iv(11, 12), iv(13, 16)], { minMinutes: 120, now: 0 });
    expect(slots).toEqual([iv(1, 3.5)]);
    const later = commonSlots([iv(0, 4)], [iv(0, 4)], { minMinutes: 60, now: 2.2 * H });
    expect(later).toEqual([iv(2.5, 4)]);
  });

  it("działa przy zmianie czasu (DST, Europe/Warsaw)", () => {
    // 29.03.2026: 02:00 → 03:00. Dostępność 01:00–05:00 czasu lokalnego to 3 h rzeczywiste.
    const a = { start: new TZDate(2026, 2, 29, 1, 0, "Europe/Warsaw").getTime(), end: new TZDate(2026, 2, 29, 5, 0, "Europe/Warsaw").getTime() };
    expect((a.end - a.start) / H).toBe(3);
    const slots = commonSlots([a], [a], { minMinutes: 180, now: 0 });
    expect(slots.length).toBe(1);
  });
});
