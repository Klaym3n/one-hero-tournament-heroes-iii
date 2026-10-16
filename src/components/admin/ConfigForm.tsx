"use client";

import { useState } from "react";
import { updateConfigAction } from "@/server/admin-actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";
import { Markdown } from "@/components/ui/Markdown";

type Config = {
  name: string;
  tagline: string;
  bannerUrl: string;
  currentRoundLabel: string;
  gameSettings: { difficulty: string; turnTimer: string; handicap: string; other: string };
  groupBestOf: number;
  knockoutBestOf: number;
  finalBestOf: number;
  thirdPlaceBestOf: number;
  minSlotMinutes: number;
};

export function GeneralConfigForm({ initial }: { initial: Config }) {
  const [v, setV] = useState(initial);
  const { pending, feedback, exec } = useAction();
  const text = (k: "name" | "tagline" | "bannerUrl" | "currentRoundLabel") => ({
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }),
  });
  const gs = (k: keyof Config["gameSettings"]) => ({
    value: v.gameSettings[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, gameSettings: { ...v.gameSettings, [k]: e.target.value } }),
  });
  const boSelect = (k: "groupBestOf" | "knockoutBestOf" | "finalBestOf" | "thirdPlaceBestOf", label: string) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-1" role="radiogroup">
        {[1, 3, 5, 7].map((n) => (
          <button type="button" key={n} role="radio" aria-checked={v[k] === n} className="tile px-3 py-1.5 font-display font-bold" onClick={() => setV({ ...v, [k]: n })}>
            Bo{n}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => updateConfigAction(v));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nazwa turnieju</label>
          <input className="input" {...text("name")} maxLength={120} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Hasło na stronie głównej</label>
          <input className="input" {...text("tagline")} maxLength={300} />
        </div>
        <div>
          <label className="label">Baner (URL https lub /grafika/ui/banner.jpg)</label>
          <input className="input" {...text("bannerUrl")} placeholder="/grafika/ui/banner.jpg" />
        </div>
        <div>
          <label className="label">Nazwa bieżącej rundy (do ogłoszeń)</label>
          <input className="input" {...text("currentRoundLabel")} placeholder="np. Faza grupowa – kolejka 2" />
        </div>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display font-bold text-gold-light">Ustawienia gry</legend>
        <div>
          <label className="label">Poziom trudności</label>
          <input className="input" {...gs("difficulty")} />
        </div>
        <div>
          <label className="label">Czas na turę</label>
          <input className="input" {...gs("turnTimer")} />
        </div>
        <div>
          <label className="label">Handicap</label>
          <input className="input" {...gs("handicap")} />
        </div>
        <div>
          <label className="label">Inne zasady</label>
          <input className="input" {...gs("other")} />
        </div>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display font-bold text-gold-light">Format meczów</legend>
        {boSelect("groupBestOf", "Faza grupowa")}
        {boSelect("knockoutBestOf", "Faza pucharowa")}
        {boSelect("finalBestOf", "Finał")}
        {boSelect("thirdPlaceBestOf", "Mecz o 3. miejsce")}
        <div>
          <label className="label">Min. długość wspólnego terminu (min)</label>
          <input
            className="input max-w-32"
            type="number"
            min={30}
            max={600}
            step={30}
            value={v.minSlotMinutes}
            onChange={(e) => setV({ ...v, minSlotMinutes: Number(e.target.value) })}
          />
        </div>
      </fieldset>
      <p className="text-xs text-cream-dim">Zmiana formatu Bo dotyczy meczów tworzonych po zapisaniu (np. drabinki generowanej później).</p>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Zapisywanie…" : "Zapisz ustawienia"}
      </button>
      <FeedbackBox feedback={feedback} />
    </form>
  );
}

const CONTENT_FIELDS = [
  ["infoMd", "Informacje"],
  ["formatMd", "Format"],
  ["prizesMd", "Nagrody"],
  ["scheduleMd", "Harmonogram"],
  ["rulesMd", "Regulamin"],
  ["privacyMd", "Polityka prywatności"],
] as const;
type ContentKey = (typeof CONTENT_FIELDS)[number][0];

export function ContentEditor({ initial }: { initial: Record<ContentKey, string> }) {
  const [tab, setTab] = useState<ContentKey>("infoMd");
  const [v, setV] = useState(initial);
  const [preview, setPreview] = useState(false);
  const { pending, feedback, exec } = useAction();
  const changed = v[tab] !== initial[tab];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1" role="tablist">
        {CONTENT_FIELDS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn btn-sm ${tab === k ? "btn-primary" : "btn-ghost"}`}>
            {label}
            {v[k] !== initial[k] ? " •" : ""}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-cream-dim">
          Format Markdown (nagłówki #, listy -, **pogrubienie**, [link](https://…)).{" "}
          {(tab === "rulesMd" || tab === "privacyMd") && "Zmiana treści podnosi numer wersji dokumentu."}
        </p>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} className="accent-[var(--gold)]" /> Podgląd
        </label>
      </div>
      <div className={preview ? "grid gap-4 lg:grid-cols-2" : ""}>
        <textarea className="textarea min-h-[420px] font-mono text-sm" value={v[tab]} onChange={(e) => setV({ ...v, [tab]: e.target.value })} aria-label="Treść" />
        {preview && (
          <div className="max-h-[520px] overflow-y-auto rounded-sm bg-black/25 p-4">
            <Markdown>{v[tab]}</Markdown>
          </div>
        )}
      </div>
      <button className="btn btn-primary" disabled={pending || !changed} onClick={() => exec(() => updateConfigAction({ [tab]: v[tab] }))}>
        Zapisz „{CONTENT_FIELDS.find(([k]) => k === tab)![1]}”
      </button>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}
