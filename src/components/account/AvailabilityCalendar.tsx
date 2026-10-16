"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TZDate } from "@date-fns/tz";
import { saveAvailabilityAction } from "@/server/actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";

const TZ = "Europe/Warsaw";
const SLOTS = 48; // 30-minutowe pola w dobie
const DAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

type Interval = { start: number; end: number };

function cellStart(week: TZDate, day: number, slot: number) {
  return new TZDate(week.getFullYear(), week.getMonth(), week.getDate() + day, Math.floor(slot / 2), (slot % 2) * 30, TZ).getTime();
}

function toCells(intervals: Interval[], week: TZDate, shiftDays = 0): Set<string> {
  const set = new Set<string>();
  for (let d = 0; d < 7; d++) {
    for (let s = 0; s < SLOTS; s++) {
      const t = cellStart(week, d - shiftDays, s);
      if (intervals.some((i) => t >= i.start && t < i.end)) set.add(`${d}:${s}`);
    }
  }
  return set;
}

function toIntervals(cells: Set<string>, week: TZDate): Interval[] {
  const out: Interval[] = [];
  for (let d = 0; d < 7; d++) {
    for (let s = 0; s < SLOTS; s++) {
      if (!cells.has(`${d}:${s}`)) continue;
      const start = cellStart(week, d, s);
      const end = start + 30 * 60_000;
      const last = out[out.length - 1];
      if (last && last.end === start) last.end = end;
      else if (!last || start > last.end) out.push({ start, end });
    }
  }
  return out;
}

export function AvailabilityCalendar({
  weekStartIso,
  intervals,
  previous,
  prevWeek,
  nextWeek,
  nowMs,
}: {
  weekStartIso: string;
  intervals: Interval[];
  previous: Interval[];
  prevWeek: string | null;
  nextWeek: string | null;
  nowMs: number;
}) {
  const week = useMemo(() => new TZDate(new Date(weekStartIso).getTime(), TZ), [weekStartIso]);
  const initial = useMemo(() => toCells(intervals, week), [intervals, week]);
  const [cells, setCells] = useState<Set<string>>(initial);
  const [dirty, setDirty] = useState(false);
  const paint = useRef<null | boolean>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // wieczory są najczęściej używane – startujemy od 16:00
  useEffect(() => {
    const row = scroller.current?.querySelector<HTMLElement>("tbody tr:nth-child(33)");
    if (scroller.current && row) scroller.current.scrollTop = row.offsetTop - 40;
  }, []);
  const { pending, feedback, exec } = useAction();
  const now = nowMs;
  const [painting, setPainting] = useState(false);

  const apply = (key: string, on: boolean) =>
    setCells((prev) => {
      if (prev.has(key) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const begin = (key: string) => {
    const on = !cells.has(key);
    paint.current = on;
    setPainting(true);
    apply(key, on);
    setDirty(true);
  };
  const enter = (key: string) => {
    if (paint.current !== null) apply(key, paint.current);
  };
  const end = () => {
    paint.current = null;
    setPainting(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
    const key = el?.dataset.cell;
    if (key) enter(key);
  };

  const dayLabel = (d: number) => {
    const date = new TZDate(week.getFullYear(), week.getMonth(), week.getDate() + d, 12, 0, TZ);
    return `${DAYS[d]} ${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const save = () => {
    const to = new TZDate(week.getFullYear(), week.getMonth(), week.getDate() + 7, 0, 0, TZ);
    exec(() => saveAvailabilityAction(new Date(week.getTime()).toISOString(), new Date(to.getTime()).toISOString(), toIntervals(cells, week)), {
      onOk: () => setDirty(false),
    });
  };

  const fillEvenings = () => {
    const next = new Set(cells);
    for (let d = 0; d < 7; d++) for (let s = 36; s < 46; s++) next.add(`${d}:${s}`); // 18:00–23:00
    setCells(next);
    setDirty(true);
  };

  return (
    <div className="space-y-4" onMouseUp={end} onMouseLeave={end} onTouchEnd={end}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {prevWeek ? (
            <Link href={`/konto/dostepnosc?w=${prevWeek}`} className="btn btn-sm btn-icon" aria-label="Poprzedni tydzień">
              ‹
            </Link>
          ) : (
            <span className="btn btn-sm btn-icon" aria-disabled="true">
              ‹
            </span>
          )}
          <span className="font-display font-bold text-gold-light">
            {dayLabel(0)} – {dayLabel(6)}
          </span>
          {nextWeek ? (
            <Link href={`/konto/dostepnosc?w=${nextWeek}`} className="btn btn-sm btn-icon" aria-label="Następny tydzień">
              ›
            </Link>
          ) : (
            <span className="btn btn-sm btn-icon" aria-disabled="true">
              ›
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={previous.length === 0}
            onClick={() => {
              setCells(toCells(previous, week, 7));
              setDirty(true);
            }}
          >
            Kopiuj poprzedni tydzień
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={fillEvenings}>
            + Wieczory 18–23
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setCells(new Set());
              setDirty(true);
            }}
          >
            Wyczyść
          </button>
          <button type="button" className="btn btn-sm btn-success" disabled={pending || !dirty} onClick={save}>
            {pending ? "Zapisywanie…" : dirty ? "Zapisz" : "Zapisano"}
          </button>
        </div>
      </div>
      <FeedbackBox feedback={feedback} />
      <p className="text-xs text-cream-dim">
        Kliknij lub przeciągnij po polach, aby zaznaczyć godziny, w których możesz grać (czas polski). Gdy Twoja dostępność pokryje się z dostępnością przeciwnika, dostaniecie powiadomienie z propozycją terminu.
      </p>
      <div ref={scroller} className="frame scroll-x max-h-[70vh] overflow-y-auto" style={{ touchAction: painting ? "none" : "pan-y" }}>
        <span className="corner-bl" aria-hidden />
        <span className="corner-br" aria-hidden />
        <table className="w-full min-w-[640px] border-collapse text-xs select-none" onTouchMove={onTouchMove}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-14 bg-[#24180a] p-1" />
              {DAYS.map((_, d) => (
                <th key={d} className="bg-[#24180a] p-1.5 font-display text-gold-light">
                  {dayLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SLOTS }, (_, s) => (
              <tr key={s}>
                <th className={`pr-2 text-right font-normal text-cream-dim ${s % 2 ? "opacity-0" : ""}`}>{`${String(Math.floor(s / 2)).padStart(2, "0")}:00`}</th>
                {DAYS.map((_, d) => {
                  const key = `${d}:${s}`;
                  const on = cells.has(key);
                  const past = cellStart(week, d, s) + 30 * 60_000 <= now;
                  return (
                    <td
                      key={key}
                      data-cell={past ? undefined : key}
                      onMouseDown={past ? undefined : () => begin(key)}
                      onMouseEnter={past ? undefined : () => enter(key)}
                      onTouchStart={past ? undefined : () => begin(key)}
                      className={`h-5 border-r border-b ${s % 2 ? "border-b-gold/15" : "border-b-black/40"} border-r-black/50 ${
                        past ? "bg-black/40" : on ? "cursor-pointer bg-emerald-light/80 hover:bg-emerald-light" : "cursor-pointer bg-white/[0.03] hover:bg-gold/20"
                      }`}
                      aria-label={`${dayLabel(d)} ${Math.floor(s / 2)}:${s % 2 ? "30" : "00"} ${on ? "dostępny" : "niedostępny"}`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
