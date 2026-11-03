"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

const SLOT = 104; // wysokość slotu meczu w pierwszej widocznej rundzie (px)
const CARD = 208; // szerokość karty meczu (w-52)
const FINAL_CARD = 240; // szerokość karty finału (w-60)
const PAD = 20; // wewnętrzny odstęp drabinki (p-5)
const THIRD_OFFSET = 130; // odległość meczu o 3. miejsce od środka finału (px)
const THIRD_BLOCK = 116; // wysokość podpisu + karty meczu o 3. miejsce (px)
const GAP = 40; // odstęp między rundami (px) – w połowie biegną pionowe łączniki

const isDone = (m: BracketMatch) => m.status === "CONFIRMED" || m.status === "WALKOVER";
const hasPlayer = (m: BracketMatch, id: string) => m.a?.id === id || m.b?.id === id;

function Row({ p, score, win, done, marked, onHover }: { p: BracketSide; score: number; win: boolean; done: boolean; marked: string | null; onHover: (id: string | null) => void }) {
  const hl = p && marked === p.id;
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

function Card({ m, marked, onHover, final }: { m: BracketMatch; marked: string | null; onHover: (id: string | null) => void; final?: boolean }) {
  const done = isDone(m);
  const involved = marked && hasPlayer(m, marked);
  return (
    <Link
      href={`/mecze/${m.id}`}
      data-players={[m.a?.id, m.b?.id].filter(Boolean).join(" ")}
      className={`frame-xs block overflow-hidden bg-[linear-gradient(180deg,#2c2016,#160e08)] transition-shadow ${final ? "w-60 shadow-[0_0_18px_rgba(241,215,122,.3)]" : "w-52"} ${
        involved ? "shadow-[0_0_0_1px_var(--gold-light),0_0_14px_rgba(241,215,122,.45)]" : ""
      }`}
    >
      <div className="divide-y divide-black/60">
        <Row p={m.a} score={m.scoreA} win={done && m.winnerId === m.a?.id} done={done} marked={marked} onHover={onHover} />
        <Row p={m.b} score={m.scoreB} win={done && m.winnerId === m.b?.id} done={done} marked={marked} onHover={onHover} />
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

/** Ile kolumn rund mieści się w danej szerokości (kolumna finału jest szersza). */
const columnsFitting = (width: number) => Math.max(1, Math.floor((width - 2 * PAD - (FINAL_CARD - CARD) + GAP) / (CARD + GAP)));

/**
 * Drabinka pojedynczej eliminacji oglądana fazami: widać wybraną fazę i tyle kolejnych, ile mieści się na ekranie,
 * a wysokość liczy się od pierwszej widocznej fazy – dzięki temu finał jest blisko. „Pokaż wszystko” daje pełny widok
 * dopasowany do szerokości; wyszukiwarka podświetla ścieżkę gracza.
 */
export function Bracket({ rounds, third }: { rounds: BracketRound[]; third: BracketMatch | null }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<number | null>(null); // null = bieżąca faza turnieju
  const [dir, setDir] = useState(0);
  const [all, setAll] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const scrollTo = useRef<string | null>(null);

  useEffect(() => {
    const s = scroller.current;
    if (!s) return;
    const ro = new ResizeObserver(() => setWidth(s.clientWidth));
    ro.observe(s);
    return () => ro.disconnect();
  }, []);

  // po skoku do gracza: przewiń do jego ostatniego meczu (także w pionie, jeśli jest poniżej ekranu)
  useEffect(() => {
    const id = scrollTo.current;
    if (!id || !scroller.current) return;
    scrollTo.current = null;
    const cards = scroller.current.querySelectorAll<HTMLElement>(`[data-players~="${CSS.escape(id)}"]`);
    cards[cards.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  });

  const count = width ? columnsFitting(width) : 3;
  const finalRound = rounds.at(-1);
  // bieżąca faza: pierwsza z nierozegranymi meczami; po zakończeniu turnieju – ostatnie fazy z finałem
  const current = rounds.findIndex((r) => r.matches.some((m) => !isDone(m)));
  const start = Math.min(sel ?? (current === -1 ? Math.max(0, rounds.length - count) : current), rounds.length - 1);
  const visible = all ? rounds : rounds.slice(start, start + count);

  const players = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of [...rounds.flatMap((r) => r.matches), ...(third ? [third] : [])]) for (const p of [m.a, m.b]) if (p) map.set(p.id, p.nick);
    return [...map].map(([id, nick]) => ({ id, nick })).sort((x, y) => x.nick.localeCompare(y.nick, "pl"));
  }, [rounds, third]);

  const final = finalRound?.matches[0];
  const champion = final && isDone(final) ? (final.winnerId === final.a?.id ? final.a : final.b) : null;

  const go = (i: number) => {
    setDir(Math.sign(i - start));
    setSel(i);
    setAll(false);
  };

  const showAll = () => {
    const natural = 2 * PAD + rounds.length * CARD + (FINAL_CARD - CARD) + (rounds.length - 1) * GAP;
    setDir(0);
    setZoom(Math.max(0.5, Math.min(1, +(width / natural).toFixed(2))));
    setAll(true);
  };

  const search = (value: string) => {
    setQuery(value);
    const p = players.find((x) => x.nick.toLowerCase() === value.trim().toLowerCase());
    setPicked(p?.id ?? null);
    if (!p) return;
    const last = rounds.findLastIndex((r) => r.matches.some((m) => hasPlayer(m, p.id)));
    // ostatnia faza gracza na prawym brzegu widoku – widać też drogę, którą do niej przeszedł
    if (!all && last >= 0) go(Math.max(0, last - count + 1));
    scrollTo.current = p.id;
  };

  const marked = hovered ?? picked;
  const height = Math.max((visible[0]?.matches.length ?? 0) * SLOT, 2 * SLOT);
  // mecz o 3. miejsce stoi pod finałem, lekko przesunięty w stronę półfinałów – kolumna finału musi mieć na niego miejsce
  const thirdTop = height / 2 + THIRD_OFFSET;
  const withThird = third && visible.at(-1) === finalRound;
  const extra = withThird ? Math.max(0, thirdTop + THIRD_BLOCK - height) : 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <button className="btn btn-sm btn-icon btn-ghost shrink-0" onClick={() => go(start - 1)} disabled={all || start === 0} aria-label="Poprzednia faza">
            ‹
          </button>
          <nav className="scroll-x min-w-0" aria-label="Fazy drabinki">
            <div className="flex w-max gap-2 p-1">
              {rounds.map((r, i) => (
                <button key={r.round} className={`btn btn-sm ${!all && i === start ? "btn-primary" : "btn-ghost"}`} aria-pressed={!all && i === start} onClick={() => go(i)}>
                  {r.name}
                </button>
              ))}
            </div>
          </nav>
          <button className="btn btn-sm btn-icon btn-ghost shrink-0" onClick={() => go(start + 1)} disabled={all || start >= rounds.length - 1} aria-label="Następna faza">
            ›
          </button>
        </div>
        <button className={`btn btn-sm ml-auto shrink-0 ${all ? "btn-primary" : "btn-ghost"}`} aria-pressed={all} onClick={() => (all ? go(start) : showAll())}>
          ⤢ Pokaż wszystko
        </button>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:w-72">
          <input
            className="input pr-9"
            list="bracket-players"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Znajdź gracza…"
            aria-label="Znajdź gracza w drabince"
          />
          <datalist id="bracket-players">
            {players.map((p) => (
              <option key={p.id} value={p.nick} />
            ))}
          </datalist>
          {query && (
            <button className="absolute inset-y-0 right-2 my-auto h-6 px-1 text-cream-dim hover:text-gold-light" onClick={() => search("")} aria-label="Wyczyść wyszukiwanie">
              ✕
            </button>
          )}
        </div>
        {all && (
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
        )}
      </div>
      <div className="frame-sm panel" style={{ "--panel-bg": "rgba(10, 7, 4, 0.78)" } as React.CSSProperties}>
        <div ref={scroller} className="scroll-x">
          <div key={all ? "all" : start} style={{ zoom: all ? zoom : 1, "--bracket-dir": dir } as React.CSSProperties} className="bracket-enter p-5">
            <div className={`flex ${all ? "" : "justify-center"}`} style={{ gap: GAP }}>
              {visible.map((r, ri) => {
                const isFinal = r === finalRound;
                return (
                  <div key={r.round} className="flex shrink-0 flex-col">
                    <h3 className="mb-3 text-center font-display text-sm font-bold tracking-wider text-gold-light uppercase">{r.name}</h3>
                    <div className="relative flex flex-col justify-around" style={{ height, marginBottom: ri === visible.length - 1 ? extra : 0 }}>
                      {r.matches.map((m) => (
                        <div key={m.id} className="relative flex items-center">
                          <Card m={m} marked={marked} onHover={setHovered} final={isFinal} />
                          {isFinal && champion && <p className="absolute inset-x-0 top-full mt-1.5 text-center text-xs font-bold tracking-wider text-gold-light uppercase">🏆 Zwycięzca: {champion.nick}</p>}
                        </div>
                      ))}
                      {ri < visible.length - 1 && <Connectors count={r.matches.length} height={height} />}
                      {isFinal && third && (
                        <div className="absolute" style={{ top: thirdTop, left: -GAP / 2 }}>
                          <p className="mb-1.5 border-t border-gold-dark/50 pt-1.5 text-center text-[11px] tracking-widest text-cream-dim uppercase">Mecz o 3. miejsce</p>
                          <Card m={third} marked={marked} onHover={setHovered} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
