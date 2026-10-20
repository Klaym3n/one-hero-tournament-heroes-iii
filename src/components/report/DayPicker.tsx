"use client";

import { mwdCode, mwdToIndex, type MWD } from "@/lib/mwd";

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

/** Wybór dnia w formacie Heroes III: Miesiąc / Tydzień / Dzień (np. 142). */
export function DayPicker({ value, onChange }: { value: MWD; onChange: (v: MWD) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Stepper label="Miesiąc" value={value.month} min={1} max={99} onChange={(month) => onChange({ ...value, month })} />
      <Stepper label="Tydzień" value={value.week} min={1} max={4} onChange={(week) => onChange({ ...value, week })} />
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] tracking-widest text-cream-dim uppercase">Dzień</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Dzień tygodnia">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button type="button" key={d} role="radio" aria-checked={value.day === d} onClick={() => onChange({ ...value, day: d })} className="tile h-10 w-8 font-display font-bold">
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="ml-auto text-right">
        <p className="title-gold text-3xl font-black tabular-nums">{mwdCode(value)}</p>
        <p className="text-xs text-cream-dim">{mwdToIndex(value)}. dzień gry</p>
      </div>
    </div>
  );
}
