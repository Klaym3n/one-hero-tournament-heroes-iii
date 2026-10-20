"use client";

import Link from "next/link";
import { useState } from "react";

export type BracketSide = { id: string; nick: string; avatarUrl: string | null } | null;
export type BracketMatch = {
  id: string;
  a: BracketSide;
  b: BracketSide;
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  status: string;
  bestOf: number;
  scheduledAt: string | null;
};
export type BracketRound = { round: number; name: string; matches: BracketMatch[] };

const SLOT = 104; // wysokość slotu meczu w 1. rundzie (px)

function Row({ p, score, win, done, hovered, onHover }: { p: BracketSide; score: number; win: boolean; done: boolean; hovered: string | null; onHover: (id: string | null) => void }) {
  const hl = p && hovered === p.id;
  return (
    <div
      onMouseEnter={() => onHover(p?.id ?? null)}
      onMouseLeave={() => onHover(null)}
      className={`flex h-8 items-center gap-2 px-2 text-sm ${win ? "bg-gold/10" : ""} ${hl ? "bg-gold/25" : ""}`}
    >
      {p ? (
        <>
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" width={18} height={18} className="rounded-sm" />
          ) : (
            <span className="h-[18px] w-[18px] rounded-sm bg-crimson/70" aria-hidden />
          )}
          <span className={`flex-1 truncate ${win ? "font-bold text-gold-light" : done ? "text-cream-dim" : ""}`}>{p.nick}</span>
        </>
      ) : (
        <span className="flex-1 truncate text-cream-dim/60 italic">oczekuje…</span>
      )}
      <span className={`w-5 text-right font-display font-bold tabular-nums ${win ? "text-gold-light" : "text-cream-dim"}`}>{done ? score : ""}</span>
    </div>
  );
}

function Card({ m, hovered, onHover }: { m: BracketMatch; hovered: string | null; onHover: (id: string | null) => void }) {
  const done = m.status === "CONFIRMED" || m.status === "WALKOVER";
  const involved = hovered && (m.a?.id === hovered || m.b?.id === hovered);
  return (
    <Link
      href={`/mecze/${m.id}`}
      className={`frame-xs block w-52 overflow-hidden bg-[linear-gradient(180deg,#2c2016,#160e08)] transition-shadow ${
        involved ? "shadow-[0_0_0_1px_var(--gold-light),0_0_14px_rgba(241,215,122,.45)]" : ""
      }`}
    >
      <div className="divide-y divide-black/60">
        <Row p={m.a} score={m.scoreA} win={done && m.winnerId === m.a?.id} done={done} hovered={hovered} onHover={onHover} />
        <Row p={m.b} score={m.scoreB} win={done && m.winnerId === m.b?.id} done={done} hovered={hovered} onHover={onHover} />
      </div>
      <div className="flex justify-between bg-black/30 px-2 py-0.5 text-[10px] tracking-wider text-cream-dim uppercase">
        <span>Bo{m.bestOf}</span>
        <span>
          {m.status === "DISPUTED"
            ? "spór"
            : m.status === "REPORTED"
              ? "czeka na potwierdzenie"
              : m.scheduledAt && !done
                ? new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(m.scheduledAt))
                : done
                  ? "zakończony"
                  : ""}
        </span>
      </div>
    </Link>
  );
}

/** Drabinka pojedynczej eliminacji z przewijaniem poziomym i powiększaniem. */
export function Bracket({ rounds, third }: { rounds: BracketRound[]; third: BracketMatch | null }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const firstCount = rounds[0]?.matches.length ?? 0;
  const height = Math.max(firstCount * SLOT, 2 * SLOT);

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="text-xs text-cream-dim">Powiększenie</span>
        <button className="btn btn-sm btn-icon" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label="Pomniejsz">
          −
        </button>
        <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button className="btn btn-sm btn-icon" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} aria-label="Powiększ">
          +
        </button>
      </div>
      <div className="frame-sm panel" style={{ "--panel-bg": "rgba(10, 7, 4, 0.78)" } as React.CSSProperties}>
        <div className="scroll-x">
        <div style={{ zoom }} className="p-5">
          <div className="flex gap-10">
            {rounds.map((r, ri) => (
              <div key={r.round} className="flex shrink-0 flex-col">
                <h3 className="mb-3 text-center font-display text-sm font-bold tracking-wider text-gold-light uppercase">{r.name}</h3>
                <div className="relative flex flex-col justify-around" style={{ height }}>
                  {r.matches.map((m) => (
                    <div key={m.id} className="relative flex items-center">
                      <Card m={m} hovered={hovered} onHover={setHovered} />
                      {ri < rounds.length - 1 && <span className="absolute top-1/2 -right-10 h-px w-10 bg-gold-dark" aria-hidden />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {third && (
              <div className="flex shrink-0 flex-col">
                <h3 className="mb-3 text-center font-display text-sm font-bold tracking-wider text-gold-light uppercase">O 3. miejsce</h3>
                <div className="flex flex-col justify-center" style={{ height }}>
                  <Card m={third} hovered={hovered} onHover={setHovered} />
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-cream-dim sm:hidden">Przesuń w bok, aby zobaczyć całą drabinkę.</p>
    </div>
  );
}
