"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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

const THIRD_OFFSET = 130; // odległość meczu o 3. miejsce od środka finału (px)
const THIRD_BLOCK = 116; // wysokość podpisu + karty meczu o 3. miejsce (px)
const GAP = 40; // odstęp między rundami (px) – w połowie biegną pionowe łączniki

/** Łączniki: poziome odcinki od meczów do osi, pionowa oś łącząca parę i odcinek do meczu kolejnej rundy. */
function Connectors({ count, height }: { count: number; height: number }) {
  const slot = height / count;
  const line = "absolute bg-gold-dark";
  return (
    <div className="pointer-events-none absolute inset-y-0 left-full" style={{ width: GAP }} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`${line} left-0 h-px`} style={{ top: (i + 0.5) * slot, width: i % 2 === 0 && i + 1 >= count ? GAP : GAP / 2 }} />
      ))}
      {Array.from({ length: Math.floor(count / 2) }, (_, k) => (
        <span key={k}>
          <span className={`${line} w-px`} style={{ left: GAP / 2, top: (2 * k + 0.5) * slot, height: slot }} />
          <span className={`${line} h-px`} style={{ left: GAP / 2, top: (2 * k + 1) * slot, width: GAP / 2 }} />
        </span>
      ))}
    </div>
  );
}

/** Położenie kolumn rund względem przewijanego kontenera – z getBoundingClientRect, więc działa przy dowolnym powiększeniu (CSS zoom). */
function columnOffsets(s: HTMLElement): number[] {
  const base = s.getBoundingClientRect().left;
  return Array.from(s.querySelectorAll<HTMLElement>("[data-col]")).map((c) => c.getBoundingClientRect().left - base + s.scrollLeft - 20);
}

/** Drabinka pojedynczej eliminacji z przewijaniem poziomym, nawigacją między rundami i powiększaniem. */
export function Bracket({ rounds, third }: { rounds: BracketRound[]; third: BracketMatch | null }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [edges, setEdges] = useState({ start: true, end: true });
  const scroller = useRef<HTMLDivElement>(null);
  const firstCount = rounds[0]?.matches.length ?? 0;
  const height = Math.max(firstCount * SLOT, 2 * SLOT);
  // mecz o 3. miejsce stoi pod finałem, lekko przesunięty w stronę półfinałów – kolumna finału musi mieć na niego miejsce
  const thirdTop = height / 2 + THIRD_OFFSET;
  const extra = third ? Math.max(0, thirdTop + THIRD_BLOCK - height) : 0;

  const sync = useCallback(() => {
    const s = scroller.current;
    if (!s) return;
    setEdges({ start: s.scrollLeft <= 4, end: s.scrollLeft + s.clientWidth >= s.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync, zoom]);

  // cel liczony od bieżącej pozycji przewinięcia: najbliższa kolumna zaczynająca się na lewo / na prawo od niej
  const step = (dir: -1 | 1) => {
    const s = scroller.current;
    if (!s) return;
    const offs = columnOffsets(s);
    const target = dir > 0 ? offs.find((o) => o > s.scrollLeft + 8) : offs.findLast((o) => o < s.scrollLeft - 8);
    s.scrollTo({ left: Math.max(0, target ?? (dir > 0 ? s.scrollWidth : 0)), behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex items-center gap-2" aria-label="Przewijanie faz drabinki">
          <button className="btn btn-sm btn-ghost" onClick={() => step(-1)} disabled={edges.start}>
            ‹ Poprzednia faza
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => step(1)} disabled={edges.end}>
            Następna faza ›
          </button>
        </nav>
        <div className="flex items-center gap-2">
          <span className="text-xs text-cream-dim">Powiększenie</span>
          <button className="btn btn-sm btn-icon" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label="Pomniejsz">
            −
          </button>
          <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button className="btn btn-sm btn-icon" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} aria-label="Powiększ">
            +
          </button>
        </div>
      </div>
      <div className="frame-sm panel" style={{ "--panel-bg": "rgba(10, 7, 4, 0.78)" } as React.CSSProperties}>
        <div ref={scroller} className="scroll-x" onScroll={sync}>
        <div style={{ zoom }} className="p-5">
          <div className="flex" style={{ gap: GAP }}>
            {rounds.map((r, ri) => (
              <div key={r.round} data-col className="flex shrink-0 flex-col">
                <h3 className="mb-3 text-center font-display text-sm font-bold tracking-wider text-gold-light uppercase">{r.name}</h3>
                <div className="relative flex flex-col justify-around" style={{ height, marginBottom: ri === rounds.length - 1 ? extra : 0 }}>
                  {r.matches.map((m) => (
                    <div key={m.id} className="relative flex items-center">
                      <Card m={m} hovered={hovered} onHover={setHovered} />
                    </div>
                  ))}
                  {ri < rounds.length - 1 && <Connectors count={r.matches.length} height={height} />}
                  {ri === rounds.length - 1 && third && (
                    <div className="absolute" style={{ top: thirdTop, left: -GAP / 2 }}>
                      <p className="mb-1.5 border-t border-gold-dark/50 pt-1.5 text-center text-[11px] tracking-widest text-cream-dim uppercase">Mecz o 3. miejsce</p>
                      <Card m={third} hovered={hovered} onHover={setHovered} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-cream-dim sm:hidden">Przesuń w bok lub użyj strzałek, aby zobaczyć całą drabinkę.</p>
    </div>
  );
}
