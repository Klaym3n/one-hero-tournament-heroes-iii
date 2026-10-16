"use client";

import { useState } from "react";
import { deleteAnnouncementAction, deleteTemplateAction, saveAnnouncementAction, saveHeroAction, saveTemplateAction } from "@/server/admin-actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";
import { FACTIONS } from "@/data/factions";

// ---------- Szablony ----------
type Tpl = { id?: string; name: string; description: string; active: boolean; sortOrder: number };

export function TemplateRow({ initial }: { initial: Tpl }) {
  const [v, setV] = useState(initial);
  const { pending, feedback, exec } = useAction();
  const isNew = !initial.id;
  return (
    <div className="space-y-2 rounded-sm bg-black/20 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto]">
        <input className="input" placeholder="Nazwa szablonu" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={60} />
        <input className="input" placeholder="Opis (opcjonalnie)" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={300} />
        <input className="input w-20" type="number" title="Kolejność" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="accent-[var(--gold)]" /> aktywny
        </label>
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-sm"
          disabled={pending}
          onClick={() => exec(() => saveTemplateAction(v), { onOk: () => isNew && setV({ name: "", description: "", active: true, sortOrder: v.sortOrder + 1 }) })}
        >
          {isNew ? "+ Dodaj szablon" : "Zapisz"}
        </button>
        {!isNew && initial.active && (
          <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => exec(() => deleteTemplateAction(initial.id!), { confirm: "Dezaktywować szablon? Historyczne raporty zostaną zachowane." })}>
            Dezaktywuj
          </button>
        )}
      </div>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

// ---------- Bohaterowie ----------
type HeroRow = { slug?: string; name: string; faction: string; heroClass: number; active: boolean };

export function HeroEditor({ hero, hasImage, classes }: { hero: HeroRow; hasImage: boolean; classes: [string, string] }) {
  const [v, setV] = useState(hero);
  const { pending, feedback, exec } = useAction();
  const isNew = !hero.slug;
  const dirty = JSON.stringify(v) !== JSON.stringify(hero);
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-sm px-2 py-1.5 ${v.active ? "bg-black/20" : "bg-black/10 opacity-60"}`}>
      <input className="input w-40 py-1 text-sm" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Imię bohatera" maxLength={40} />
      <select className="select w-auto py-1 text-xs" value={v.heroClass} onChange={(e) => setV({ ...v, heroClass: Number(e.target.value) })}>
        <option value={0}>{classes[0]}</option>
        <option value={1}>{classes[1]}</option>
      </select>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="accent-[var(--gold)]" /> aktywny
      </label>
      {!isNew && (
        <span className={`text-[10px] ${hasImage ? "text-emerald-light" : "text-cream-dim"}`} title={`public/assets/heroes/${hero.slug}.png`}>
          {hasImage ? "grafika ✔" : `${hero.slug}.png`}
        </span>
      )}
      {(dirty || isNew) && (
        <button
          className="btn btn-sm"
          disabled={pending || v.name.trim().length < 2}
          onClick={() => exec(() => saveHeroAction(v), { onOk: () => isNew && setV({ ...hero, name: "" }) })}
        >
          {isNew ? "+ Dodaj" : "Zapisz"}
        </button>
      )}
      <FeedbackBox feedback={feedback} />
    </div>
  );
}

export function FactionTabs({ current }: { current: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {FACTIONS.map((f) => (
        <a key={f.slug} href={`/admin/bohaterowie?f=${f.slug}`} className={`btn btn-sm ${current === f.slug ? "btn-primary" : "btn-ghost"}`}>
          {f.name}
        </a>
      ))}
    </div>
  );
}

// ---------- Ogłoszenia ----------
type Ann = { id?: string; title: string; bodyMd: string; pinned: boolean; published: boolean };

export function AnnouncementEditor({ initial }: { initial: Ann }) {
  const [v, setV] = useState(initial);
  const { pending, feedback, exec } = useAction();
  const isNew = !initial.id;
  return (
    <div className="space-y-2">
      <input className="input font-semibold" placeholder="Tytuł ogłoszenia" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} />
      <textarea className="textarea font-mono text-sm" rows={isNew ? 6 : 4} placeholder="Treść (Markdown)" value={v.bodyMd} onChange={(e) => setV({ ...v, bodyMd: e.target.value })} />
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.pinned} onChange={(e) => setV({ ...v, pinned: e.target.checked })} className="accent-[var(--gold)]" /> przypięte
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.published} onChange={(e) => setV({ ...v, published: e.target.checked })} className="accent-[var(--gold)]" /> opublikowane
        </label>
        <button
          className="btn btn-sm btn-primary"
          disabled={pending}
          onClick={() => exec(() => saveAnnouncementAction(v), { onOk: () => isNew && setV({ title: "", bodyMd: "", pinned: false, published: true }) })}
        >
          {isNew ? "Opublikuj" : "Zapisz"}
        </button>
        {!isNew && (
          <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => exec(() => deleteAnnouncementAction(initial.id!), { confirm: "Usunąć ogłoszenie?" })}>
            Usuń
          </button>
        )}
      </div>
      <FeedbackBox feedback={feedback} />
    </div>
  );
}
