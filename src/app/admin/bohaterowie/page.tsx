import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { FactionTabs, HeroEditor } from "@/components/admin/CrudForms";
import { FactionIcon } from "@/components/game/FactionIcon";
import { pageRequireRole } from "@/lib/authz";
import { getHeroes } from "@/lib/tournament/current";
import { getAssetManifest } from "@/lib/assets";
import { FACTION_BY_SLUG, isFactionSlug } from "@/data/factions";

export default async function AdminHeroesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await connection();
  await pageRequireRole("ADMIN");
  const { f } = await searchParams;
  const faction = f && isFactionSlug(f) ? f : "castle";
  const info = FACTION_BY_SLUG[faction];
  const [heroes, assets] = await Promise.all([getHeroes(false), getAssetManifest()]);
  const list = heroes.filter((h) => h.faction === faction);

  return (
    <div className="space-y-6">
      <h1 className="title-gold text-3xl font-black">Bohaterowie</h1>
      <FactionTabs current={faction} />
      <Frame
        title={
          <span className="flex items-center gap-3">
            <FactionIcon slug={faction} hasImage={assets.factions.includes(`${faction}.png`)} size={28} /> {info.name} ({info.nameEn})
          </span>
        }
      >
        <p className="mb-4 text-xs text-cream-dim">
          Herb: <code>public/assets/factions/{faction}.png</code> {assets.factions.includes(`${faction}.png`) ? "✔" : "(brak – placeholder)"}. Portrety: <code>public/assets/heroes/&lt;slug&gt;.png</code>. Nieaktywni bohaterowie nie są dostępni w raportach.
        </p>
        <div className="space-y-1.5">
          {list.map((h) => (
            <HeroEditor
              key={h.slug}
              hero={{ slug: h.slug, name: h.name, faction: h.faction, heroClass: h.heroClass, active: h.active }}
              hasImage={assets.heroes.includes(`${h.slug}.png`)}
              classes={info.classes}
            />
          ))}
        </div>
        <div className="mt-5 border-t border-gold/20 pt-4">
          <p className="label">Dodaj bohatera</p>
          <HeroEditor hero={{ name: "", faction, heroClass: 0, active: true }} hasImage={false} classes={info.classes} />
        </div>
      </Frame>
    </div>
  );
}
