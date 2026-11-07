"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FACTIONS, FACTION_BY_SLUG, type FactionSlug } from "@/data/factions";
import { PLAYER_COLORS, oppositeColor, playerColor, type PlayerColorSlug } from "@/data/colors";
import { Avatar } from "@/components/ui/Avatar";
import { PlayerFlag } from "@/components/game/PlayerFlag";
import { FactionIcon } from "@/components/game/FactionIcon";
import { HeroPortrait } from "@/components/game/HeroPortrait";
import { submitReportAction } from "@/server/actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";
import { DayPicker } from "./DayPicker";

export type HeroOption = { slug: string; name: string; faction: string; heroClass: number };
type Side = "A" | "B";
type Game = {
  winner: Side | null;
  colorA: PlayerColorSlug | null;
  colorB: PlayerColorSlug | null;
  mapTemplateId: string | null;
  factionA: string | null;
  factionB: string | null;
  heroA: string | null;
  heroB: string | null;
  day: { month: number; week: number; day: number };
  notes: string;
};

const emptyGame = (prev?: Game): Game => ({
  winner: null,
  // kolejna gra startuje z kolorami poprzedniej – gracze mogą je zmienić
  colorA: prev?.colorA ?? null,
  colorB: prev?.colorB ?? null,
  mapTemplateId: prev?.mapTemplateId ?? null,
  factionA: null,
  factionB: null,
  heroA: null,
  heroB: null,
  day: prev?.day ?? { month: 1, week: 3, day: 1 },
  notes: "",
});

type Props = {
  matchId: string;
  bestOf: number;
  nickA: string;
  nickB: string;
  avatarA?: string | null;
  avatarB?: string | null;
  mySide: Side | null;
  /** aktywne szablony – w turnieju gra się na jednym, więc gracz go nie wybiera (bierzemy pierwszy) */
  templates: { id: string; name: string }[];
  heroes: HeroOption[];
  assets: { factions: string[]; heroes: string[]; flags?: string[] };
  /** tryb moderatora – własna akcja zapisu */
  onSubmitOverride?: (payload: unknown) => Promise<import("@/server/errors").ActionResult<unknown>>;
  submitLabel?: string;
};

function HeroTile({ h, selected, onPick, assets, accent }: { h: HeroOption; selected: boolean; onPick: () => void; assets: Props["assets"]; accent: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className="tile flex flex-col items-center gap-1.5 p-2"
      style={selected ? { boxShadow: `0 0 0 2px ${accent}, 0 0 12px ${accent}` } : undefined}
      title={h.name}
    >
      <HeroPortrait slug={h.slug} name={h.name} faction={h.faction} hasImage={assets.heroes.includes(`${h.slug}.png`)} size={64} />
      <span className="w-full text-center text-xs leading-tight font-semibold break-words">{h.name}</span>
    </button>
  );
}

const HERO_GRID = "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-4";

/**
 * Bohaterowie frakcji startowej na górze; bohatera z innej frakcji (np. z tawerny) wybiera się z rozwijanej listy.
 * Po wyborze lista się zwija, a wybrany bohater spoza frakcji zostaje przypięty nad bohaterami frakcji.
 */
function HeroPicker({
  faction,
  value,
  onChange,
  heroes,
  assets,
  accent,
}: {
  faction: string | null;
  value: string | null;
  onChange: (slug: string) => void;
  heroes: HeroOption[];
  assets: Props["assets"];
  accent: string;
}) {
  const [q, setQ] = useState("");
  const selected = heroes.find((h) => h.slug === value);
  const [showOther, setShowOther] = useState(false);
  if (!faction) return <p className="py-3 text-sm text-cream-dim italic">Najpierw wybierz frakcję startową.</p>;
  const f = FACTION_BY_SLUG[faction as FactionSlug];
  const query = q.trim().toLowerCase();
  const match = (h: HeroOption) => !query || h.name.toLowerCase().includes(query);
  const own = heroes.filter((h) => h.faction === faction && match(h));
  const others = FACTIONS.filter((x) => x.slug !== faction)
    .map((x) => ({ faction: x, list: heroes.filter((h) => h.faction === x.slug && match(h)) }))
    .filter((g) => g.list.length > 0);
  const otherOpen = showOther || Boolean(query);
  const pinned = selected && selected.faction !== faction ? selected : null;
  const pickOther = (slug: string) => {
    onChange(slug);
    setShowOther(false);
    setQ("");
  };
  return (
    <div className="space-y-2">
      <input className="input py-1.5 text-sm" placeholder="Szukaj bohatera po imieniu…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Szukaj bohatera" />
      {pinned && !query && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] tracking-widest text-cream-dim uppercase">
            <FactionIcon slug={pinned.faction} hasImage={assets.factions.includes(`${pinned.faction}.png`)} size={20} title={false} />
            Bohater z innej frakcji · {FACTION_BY_SLUG[pinned.faction as FactionSlug]?.name}
          </p>
          <div className={HERO_GRID} role="radiogroup">
            <HeroTile h={pinned} selected onPick={() => undefined} assets={assets} accent={accent} />
          </div>
        </div>
      )}
      <div>
        <p className="mb-1 text-[11px] tracking-widest text-cream-dim uppercase">{f?.name}</p>
        {own.length ? (
          <div className={HERO_GRID} role="radiogroup">
            {own.map((h) => (
              <HeroTile key={h.slug} h={h} selected={value === h.slug} onPick={() => onChange(h.slug)} assets={assets} accent={accent} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-cream-dim">Brak bohaterów.</p>
        )}
      </div>
      {!query && (
        <button type="button" className="btn btn-sm btn-ghost" aria-expanded={showOther} onClick={() => setShowOther((v) => !v)}>
          {showOther ? "▲ Ukryj bohaterów innych frakcji" : "▼ Bohater z innej frakcji"}
        </button>
      )}
      {otherOpen &&
        others.map((g) => (
          <div key={g.faction.slug}>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] tracking-widest text-cream-dim uppercase">
              <FactionIcon slug={g.faction.slug} hasImage={assets.factions.includes(`${g.faction.slug}.png`)} size={20} title={false} />
              {g.faction.name}
            </p>
            <div className={HERO_GRID} role="radiogroup">
              {g.list.map((h) => (
                <HeroTile key={h.slug} h={h} selected={value === h.slug} onPick={() => pickOther(h.slug)} assets={assets} accent={accent} />
              ))}
            </div>
          </div>
        ))}
      {query && own.length === 0 && others.length === 0 && <p className="text-sm text-cream-dim">Brak bohaterów.</p>}
    </div>
  );
}

/**
 * Przełącznik kolorów pod przyciskami „Kto wygrał?”: lewa połowa = gracz A, prawa = gracz B.
 * Kliknięcie zamienia czerwony i niebieski miejscami (z animacją przesunięcia); pierwsze kliknięcie ustawia A = czerwony.
 */
function ColorSwitch({ colorA, onChange, flags, label }: { colorA: PlayerColorSlug | null; onChange: (a: PlayerColorSlug) => void; flags?: string[]; label: string }) {
  const set = colorA !== null;
  // pozycja czerwonego: 0 = po stronie gracza A (lewa), 1 = po stronie gracza B (prawa)
  const redPos = colorA === "blue" ? 1 : 0;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={set && colorA === "red"}
      aria-label={label}
      title="Kliknij, aby zamienić kolory graczy"
      onClick={() => onChange(colorA === "red" ? "blue" : "red")}
      className="tile relative block h-11 w-full overflow-hidden p-0"
    >
      {set ? (
        PLAYER_COLORS.map((c) => {
          const pos = c.slug === "red" ? redPos : 1 - redPos;
          return (
            <span
              key={c.slug}
              className="absolute inset-y-0 left-0 flex w-1/2 items-center justify-center gap-2 text-sm font-bold text-white transition-transform duration-300 ease-out [text-shadow:0_1px_2px_#000]"
              style={{ transform: `translateX(${pos * 100}%)`, background: `linear-gradient(180deg, ${c.hex}, color-mix(in srgb, ${c.hex} 55%, #000))` }}
            >
              <PlayerFlag color={c.slug} flags={flags} size={22} />
              {c.name}
            </span>
          );
        })
      ) : (
        <span className="flex h-full items-center justify-center gap-2 text-sm text-cream-dim">
          <PlayerFlag color="red" flags={flags} size={16} />
          Kliknij, aby ustawić kolory
          <PlayerFlag color="blue" flags={flags} size={16} />
        </span>
      )}
      {set && (
        <span className="absolute top-1/2 left-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gold/60 bg-[#1c130b] text-sm text-gold-light shadow-[0_0_6px_#000]" aria-hidden>
          ⇄
        </span>
      )}
    </button>
  );
}

function FactionPicker({ value, onChange, assets, accent }: { value: string | null; onChange: (f: string) => void; assets: Props["assets"]; accent: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-4" role="radiogroup">
      {FACTIONS.map((f) => (
        <button
          type="button"
          key={f.slug}
          role="radio"
          aria-checked={value === f.slug}
          onClick={() => onChange(f.slug)}
          className="tile flex flex-col items-center gap-1.5 px-1 py-2"
          style={value === f.slug ? { boxShadow: `0 0 0 2px ${accent}, 0 0 12px ${accent}` } : undefined}
        >
          <FactionIcon slug={f.slug} hasImage={assets.factions.includes(`${f.slug}.png`)} size={56} title={false} />
          <span className="w-full text-center text-xs leading-tight font-semibold break-words">{f.name}</span>
        </button>
      ))}
    </div>
  );
}

export function ReportForm({ matchId, bestOf, nickA, nickB, avatarA, avatarB, mySide, templates, heroes, assets, onSubmitOverride, submitLabel }: Props) {
  const router = useRouter();
  const need = Math.ceil(bestOf / 2);
  const [games, setGames] = useState<Game[]>(() => {
    const first = emptyGame();
    first.mapTemplateId = templates[0]?.id ?? null;
    return Array.from({ length: need }, () => ({ ...first }));
  });
  const [summary, setSummary] = useState("");
  const [vodUrl, setVodUrl] = useState("");
  // kilka gier może być rozwiniętych jednocześnie
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));
  const toggle = (i: number, force?: boolean) =>
    setOpen((o) => {
      const n = new Set(o);
      if (force ?? !n.has(i)) n.add(i);
      else n.delete(i);
      return n;
    });
  const { pending, feedback, exec } = useAction();

  const score = useMemo(() => {
    let a = 0;
    let b = 0;
    let decidedAt = -1;
    games.forEach((g, i) => {
      if (g.winner === "A") a++;
      if (g.winner === "B") b++;
      if (decidedAt < 0 && (a === need || b === need)) decidedAt = i;
    });
    return { a, b, decided: decidedAt >= 0, decidedAt };
  }, [games, need]);

  const update = (i: number, patch: Partial<Game>) => setGames((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  /** kolor gracza A w grze i; B dostaje drugi kolor. Kolejne gry bez kolorów dostają ten sam układ jako podpowiedź. */
  const setColor = (i: number, a: PlayerColorSlug) => {
    const patch = { colorA: a, colorB: oppositeColor(a) };
    setGames((gs) => gs.map((g, j) => (j === i || (j > i && !g.colorA && !g.colorB) ? { ...g, ...patch } : g)));
  };
  const complete = (g: Game) => Boolean(g.winner && g.colorA && g.colorB && g.colorA !== g.colorB && g.mapTemplateId && g.factionA && g.factionB && g.heroA && g.heroB);
  const extra = score.decided && games.length > score.decidedAt + 1;
  const ready = score.decided && !extra && games.every(complete);

  const submit = () => {
    const payload = { games: games.map((g) => ({ ...g })), summary, vodUrl };
    exec(() => (onSubmitOverride ? onSubmitOverride(payload) : submitReportAction(matchId, payload)), {
      onOk: () => {
        if (!onSubmitOverride) router.push(`/mecze/${matchId}`);
      },
    });
  };

  const nick = (s: Side) => (s === "A" ? nickA : nickB);
  // akcent gracza w danej grze = wybrany kolor; dopóki nie wybrano – neutralne złoto
  const accent = (s: Side, g?: Game) => playerColor(g ? (s === "A" ? g.colorA : g.colorB) : null)?.hex ?? "var(--gold-dark)";

  return (
    <div className="space-y-6">
      <div className="frame-sm panel sticky top-16 z-20" style={{ "--panel-bg": "#1c130b" } as React.CSSProperties}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 max-sm:gap-2 max-sm:px-2">
          <span className="flex min-w-0 items-center gap-3 max-sm:gap-2">
            <Avatar src={avatarA} name={nickA} size={40} />
            <span className="truncate font-display text-xl font-bold max-sm:text-sm">{nickA}</span>
          </span>
          <span className="title-gold shrink-0 text-3xl font-black tabular-nums max-sm:text-2xl">
            {score.a} : {score.b}
          </span>
          <span className="flex min-w-0 flex-row-reverse items-center gap-3 text-right max-sm:gap-2">
            <Avatar src={avatarB} name={nickB} size={40} />
            <span className="truncate font-display text-xl font-bold max-sm:text-sm">{nickB}</span>
          </span>
        </div>
        <p className="pb-2 text-center text-xs text-cream-dim">
          Bo{bestOf} · do {need} zwycięstw {score.decided ? "· seria rozstrzygnięta" : ""}
        </p>
      </div>

      {templates.length === 0 && <p className="rounded-sm border border-crimson-light/50 bg-crimson/20 px-3 py-2 text-sm">Brak aktywnego szablonu mapy – skontaktuj się z organizatorem.</p>}

      {games.map((g, i) => {
        const isOpen = open.has(i);
        const done = complete(g);
        const afterDecided = score.decided && i > score.decidedAt;
        return (
          <section key={i} className={`frame-sm panel ${afterDecided ? "opacity-60" : ""}`}>
            <button type="button" onClick={() => toggle(i)} className="frame-header flex w-full items-center justify-between px-4 py-2.5 text-left max-sm:gap-2 max-sm:px-3" aria-expanded={isOpen}>
              <span className="font-display text-lg font-bold text-gold-light">Gra {i + 1}</span>
              <span className="flex items-center gap-2 text-xs max-sm:flex-wrap max-sm:justify-end max-sm:gap-1">
                {g.winner && <span className="badge badge-gold">Wygrywa {nick(g.winner)}</span>}
                {done ? <span className="badge badge-green">✔ kompletna</span> : <span className="badge">do uzupełnienia</span>}
                <span aria-hidden>{isOpen ? "▲" : "▼"}</span>
              </span>
            </button>
            {isOpen && (
              <div className="space-y-6 p-4">
                {afterDecided && <p className="text-sm text-[#ffb3b8]">Seria była już rozstrzygnięta – usuń tę grę.</p>}
                <div>
                  <p className="label">Kto wygrał?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["A", "B"] as Side[]).map((s) => (
                      <button
                        type="button"
                        key={s}
                        aria-pressed={g.winner === s}
                        onClick={() => update(i, { winner: s })}
                        className="tile flex items-center justify-center gap-2 px-3 py-3 font-display font-bold max-sm:min-w-0 max-sm:gap-1.5 max-sm:px-2 max-sm:text-sm"
                        style={g.winner === s ? { boxShadow: `0 0 0 2px ${accent(s, g)}, 0 0 14px ${accent(s, g)}` } : undefined}
                      >
                        <PlayerFlag color={s === "A" ? g.colorA : g.colorB} flags={assets.flags} size={18} />
                        <span className="truncate">{nick(s)}</span>
                        {mySide === s && <span className="text-[10px] text-cream-dim">(Ty)</span>}
                      </button>
                    ))}
                  </div>
                  <p className="label mt-4">Kolory graczy</p>
                  <ColorSwitch colorA={g.colorA} onChange={(a) => setColor(i, a)} flags={assets.flags} label={`Kolory w grze ${i + 1}: ${nickA} po lewej, ${nickB} po prawej`} />
                </div>

                <div className="grid gap-6 max-sm:grid-cols-1 lg:grid-cols-2">
                  {(["A", "B"] as Side[]).map((s) => {
                    const fk = s === "A" ? "factionA" : "factionB";
                    const hk = s === "A" ? "heroA" : "heroB";
                    return (
                      <div key={s} className="space-y-3 rounded-sm border border-black/50 bg-black/15 p-3">
                        <p className="flex items-center gap-2 font-display font-bold">
                          <PlayerFlag color={s === "A" ? g.colorA : g.colorB} flags={assets.flags} size={18} />
                          {nick(s)}
                        </p>
                        <div>
                          <p className="label">Frakcja startowa</p>
                          <FactionPicker value={g[fk]} onChange={(f) => update(i, { [fk]: f, [hk]: g[fk] !== f && heroes.find((h) => h.slug === g[hk])?.faction === g[fk] ? null : g[hk] } as Partial<Game>)} assets={assets} accent={accent(s, g)} />
                        </div>
                        <div>
                          <p className="label">Bohater</p>
                          <HeroPicker key={`${g[fk]}`} faction={g[fk]} value={g[hk]} onChange={(h) => update(i, { [hk]: h } as Partial<Game>)} heroes={heroes} assets={assets} accent={accent(s, g)} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <p className="label">Dzień zakończenia rozgrywki</p>
                  <DayPicker value={g.day} onChange={(day) => update(i, { day })} />
                </div>

                <div>
                  <label className="label" htmlFor={`notes-${i}`}>
                    Notatka do gry (opcjonalnie)
                  </label>
                  <input id={`notes-${i}`} className="input" maxLength={500} value={g.notes} onChange={(e) => update(i, { notes: e.target.value })} placeholder="Np. decydująca bitwa o Smoczą Utopię w 2 tygodniu" />
                </div>

                {i < games.length - 1 && (
                  <button type="button" className="btn btn-sm" onClick={() => toggle(i + 1, true)}>
                    Dalej: gra {i + 2} →
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}

      <div className="flex flex-wrap gap-2">
        {!score.decided && games.length < bestOf && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setGames((gs) => [...gs, emptyGame(gs[gs.length - 1])]);
              toggle(games.length, true);
            }}
          >
            + Dodaj grę {games.length + 1}
          </button>
        )}
        {games.length > need && (
          <button type="button" className="btn btn-ghost" onClick={() => setGames((gs) => gs.slice(0, -1))}>
            − Usuń ostatnią grę
          </button>
        )}
      </div>

      <section className="frame-sm panel">
        <div className="space-y-4 p-4">
          <div>
            <label className="label" htmlFor="vod">
              Link do nagrania / VOD (opcjonalnie)
            </label>
            <input id="vod" className="input" type="url" inputMode="url" value={vodUrl} onChange={(e) => setVodUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=… / twitch.tv / kick.com" />
          </div>
          <div>
            <label className="label" htmlFor="summary">
              Opis przebiegu rozgrywki (opcjonalnie)
            </label>
            <textarea id="summary" className="textarea" rows={4} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Kilka słów od siebie o przebiegu meczu…" />
          </div>
          <button type="button" className="btn btn-primary w-full py-3 text-base" disabled={pending || !ready} onClick={submit}>
            {pending ? "Wysyłanie…" : (submitLabel ?? `Wyślij raport (${score.a}:${score.b})`)}
          </button>
          {!ready && <p className="text-center text-xs text-cream-dim">{extra ? "Usuń gry rozegrane po rozstrzygnięciu serii." : !score.decided ? `Uzupełnij gry aż do ${need} zwycięstw jednego z graczy.` : "Uzupełnij wszystkie pola w każdej grze (w tym kolory graczy)."}</p>}
          <FeedbackBox feedback={feedback} />
        </div>
      </section>
    </div>
  );
}
