"use client";

import { MAX_END_DAY, mwdCode, mwdToIndex, type MWD } from "@/lib/mwd";

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] tracking-widest text-cream-dim uppercase">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-sm btn-icon" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${label} −1`}>
          −
        </button>
        <span className="stone frame-xs flex h-10 w-10 items-center justify-center font-display text-xl font-bold text-gold-light" aria-live="polite">
          {value}
        </span>
        <button type="button" className="btn btn-sm btn-icon" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label} +1`}>
          +
        </button>
      </div>
    </div>
  );
}

const afterMax = (v: MWD, max: MWD) => mwdToIndex(v) > mwdToIndex(max);

/** Przycina dzień do ostatecznego terminu (np. zmiana miesiąca 1→2 przy tygodniu 4, dniu 5 daje 242). */
function clamp(v: MWD, max: MWD): MWD {
  return afterMax(v, max) ? { ...max } : v;
}

/** Wybór dnia w formacie Heroes III: Miesiąc / Tydzień / Dzień (np. 142), najpóźniej `max` (domyślnie 242). */
export function DayPicker({ value, onChange, max = MAX_END_DAY }: { value: MWD; onChange: (v: MWD) => void; max?: MWD }) {
  const set = (patch: Partial<MWD>) => onChange(clamp({ ...value, ...patch }, max));
  const maxWeek = value.month === max.month ? max.week : 4;
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Stepper label="Miesiąc" value={value.month} min={1} max={max.month} onChange={(month) => set({ month })} />
      <Stepper label="Tydzień" value={value.week} min={1} max={maxWeek} onChange={(week) => set({ week })} />
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] tracking-widest text-cream-dim uppercase">Dzień</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Dzień tygodnia">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const disabled = afterMax({ ...value, day: d }, max);
            return (
              <button
                type="button"
                key={d}
                role="radio"
                aria-checked={value.day === d}
                disabled={disabled}
                onClick={() => set({ day: d })}
                className={`tile h-10 w-8 font-display font-bold ${disabled ? "cursor-not-allowed opacity-30" : ""}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
      <div className="ml-auto text-right">
        <p className="title-gold text-3xl font-black tabular-nums">{mwdCode(value)}</p>
        <p className="text-xs text-cream-dim">
          {mwdToIndex(value)}. dzień gry · najpóźniej {mwdCode(max)}
        </p>
      </div>
    </div>
  );
}
