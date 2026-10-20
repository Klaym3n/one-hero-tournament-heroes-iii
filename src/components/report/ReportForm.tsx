"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FACTIONS, FACTION_BY_SLUG, type FactionSlug } from "@/data/factions";
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
  mySide: Side | null;
  templates: { id: string; name: string }[];
  heroes: HeroOption[];
  assets: { factions: string[]; heroes: string[] };
  /** tryb moderatora – własna akcja zapisu */
  onSubmitOverride?: (payload: unknown) => Promise<import("@/server/errors").ActionResult<unknown>>;
  submitLabel?: string;
};

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
  if (!faction) return <p className="py-3 text-sm text-cream-dim italic">Najpierw wybierz frakcję.</p>;
  const f = FACTION_BY_SLUG[faction as FactionSlug];
  const list = heroes.filter((h) => h.faction === faction && (!q || h.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="space-y-2">
      <input className="input py-1.5 text-sm" placeholder={`Szukaj bohatera (${f?.name})…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Szukaj bohatera" />
      {[0, 1].map((cls) => {
        const group = list.filter((h) => h.heroClass === cls);
        if (!group.length) return null;
        return (
          <div key={cls}>
            <p className="mb-1 text-[10px] tracking-widest text-cream-dim uppercase">{f?.classes[cls]}</p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6" role="radiogroup">
              {group.map((h) => (
                <button
                  type="button"
                  key={h.slug}
                  role="radio"
                  aria-checked={value === h.slug}
                  onClick={() => onChange(h.slug)}
                  className="tile flex flex-col items-center gap-1 p-1.5"
                  style={value === h.slug ? { boxShadow: `0 0 0 2px ${accent}, 0 0 12px ${accent}` } : undefined}
                  title={h.name}
                >
                  <HeroPortrait slug={h.slug} name={h.name} faction={h.faction} hasImage={assets.heroes.includes(`${h.slug}.png`)} size={36} />
                  <span className="w-full truncate text-center text-[10px] leading-tight">{h.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {list.length === 0 && <p className="text-sm text-cream-dim">Brak bohaterów.</p>}
    </div>
  );
}

function FactionPicker({ value, onChange, assets, accent }: { value: string | null; onChange: (f: string) => void; assets: Props["assets"]; accent: string }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" role="radiogroup">
      {FACTIONS.map((f) => (
        <button
          type="button"
          key={f.slug}
          role="radio"
          aria-checked={value === f.slug}
          onClick={() => onChange(f.slug)}
          className="tile flex flex-col items-center gap-1 px-1 py-1.5"
          style={value === f.slug ? { boxShadow: `0 0 0 2px ${accent}, 0 0 12px ${accent}` } : undefined}
        >
          <FactionIcon slug={f.slug} hasImage={assets.factions.includes(`${f.slug}.png`)} size={30} title={false} />
          <span className="w-full truncate text-center text-[10px] leading-tight">{f.name}</span>
        </button>
      ))}
    </div>
  );
}

export function ReportForm({ matchId, bestOf, nickA, nickB, mySide, templates, heroes, assets, onSubmitOverride, submitLabel }: Props) {
  const router = useRouter();
  const need = Math.ceil(bestOf / 2);
  const [games, setGames] = useState<Game[]>(() => {
    const first = emptyGame();
    if (templates.length === 1) first.mapTemplateId = templates[0].id;
    return Array.from({ length: need }, () => ({ ...first }));
  });
  const [summary, setSummary] = useState("");
  const [vodUrl, setVodUrl] = useState("");
  const [open, setOpen] = useState(0);
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
  const complete = (g: Game) => Boolean(g.winner && g.mapTemplateId && g.factionA && g.factionB && g.heroA && g.heroB);
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
  const accent = (s: Side) => (s === "A" ? "var(--red-player)" : "var(--blue-player)");

  return (
    <div className="space-y-6">
      <div className="frame-sm panel sticky top-16 z-20" style={{ "--panel-bg": "#1c130b" } as React.CSSProperties}>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-5 w-1 bg-red-player" />
            <span className="truncate font-semibold">{nickA}</span>
          </span>
          <span className="title-gold shrink-0 text-3xl font-black tabular-nums">
            {score.a} : {score.b}
          </span>
          <span className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate font-semibold">{nickB}</span>
            <span className="h-5 w-1 bg-blue-player" />
          </span>
        </div>
        <p className="pb-2 text-center text-xs text-cream-dim">
          Bo{bestOf} · do {need} zwycięstw {score.decided ? "· seria rozstrzygnięta" : ""}
        </p>
      </div>

      {games.map((g, i) => {
        const isOpen = open === i;
        const done = complete(g);
        const afterDecided = score.decided && i > score.decidedAt;
        return (
          <section key={i} className={`frame-sm panel ${afterDecided ? "opacity-60" : ""}`}>
            <button type="button" onClick={() => setOpen(isOpen ? -1 : i)} className="frame-header flex w-full items-center justify-between px-4 py-2.5 text-left" aria-expanded={isOpen}>
              <span className="font-display text-lg font-bold text-gold-light">Gra {i + 1}</span>
              <span className="flex items-center gap-2 text-xs">
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
                        className="tile flex items-center justify-center gap-2 px-3 py-3 font-display font-bold"
                        style={g.winner === s ? { boxShadow: `0 0 0 2px ${accent(s)}, 0 0 14px ${accent(s)}` } : undefined}
                      >
                        <span className="h-4 w-1" style={{ background: accent(s) }} />
                        <span className="truncate">{nick(s)}</span>
                        {mySide === s && <span className="text-[10px] text-cream-dim">(Ty)</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="label">Szablon mapy</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup">
                    {templates.map((t) => (
                      <button type="button" key={t.id} role="radio" aria-checked={g.mapTemplateId === t.id} onClick={() => update(i, { mapTemplateId: t.id })} className="tile px-3 py-2 text-sm font-semibold">
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {(["A", "B"] as Side[]).map((s) => {
                    const fk = s === "A" ? "factionA" : "factionB";
                    const hk = s === "A" ? "heroA" : "heroB";
                    return (
                      <div key={s} className="space-y-3 rounded-sm border border-black/50 bg-black/15 p-3" style={{ boxShadow: `inset 3px 0 0 ${accent(s)}` }}>
                        <p className="font-display font-bold">{nick(s)}</p>
                        <div>
                          <p className="label">Frakcja</p>
                          <FactionPicker value={g[fk]} onChange={(f) => update(i, { [fk]: f, [hk]: g[fk] === f ? g[hk] : null } as Partial<Game>)} assets={assets} accent={accent(s)} />
                        </div>
                        <div>
                          <p className="label">Bohater</p>
                          <HeroPicker faction={g[fk]} value={g[hk]} onChange={(h) => update(i, { [hk]: h } as Partial<Game>)} heroes={heroes} assets={assets} accent={accent(s)} />
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
                  <button type="button" className="btn btn-sm" onClick={() => setOpen(i + 1)}>
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
              setOpen(games.length);
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
          {!ready && <p className="text-center text-xs text-cream-dim">{extra ? "Usuń gry rozegrane po rozstrzygnięciu serii." : !score.decided ? `Uzupełnij gry aż do ${need} zwycięstw jednego z graczy.` : "Uzupełnij wszystkie pola w każdej grze."}</p>}
          <FeedbackBox feedback={feedback} />
        </div>
      </section>
    </div>
  );
}
