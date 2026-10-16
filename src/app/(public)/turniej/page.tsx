import type { Metadata } from "next";
import { connection } from "next/server";
import { Frame, PageTitle } from "@/components/ui/Frame";
import { Markdown } from "@/components/ui/Markdown";
import { getTemplates, getTournament } from "@/lib/tournament/current";
import { FACTIONS } from "@/data/factions";
import { FactionIcon } from "@/components/game/FactionIcon";
import { getAssetManifest } from "@/lib/assets";
import { LiveRefresh } from "@/components/LiveRefresh";

export const metadata: Metadata = { title: "Informacje o turnieju" };

export default async function TournamentInfoPage() {
  await connection();
  const t = await getTournament();
  const [templates, assets] = await Promise.all([getTemplates(t.id, true), getAssetManifest()]);
  const s = t.gameSettings;
  const settings = [
    ["Poziom trudności", s.difficulty],
    ["Czas na turę", s.turnTimer],
    ["Handicap", s.handicap],
    ["Faza grupowa", `Bo${t.groupBestOf}, każdy z każdym`],
    ["Faza pucharowa", `Bo${t.knockoutBestOf}, finał Bo${t.finalBestOf}, o 3. miejsce Bo${t.thirdPlaceBestOf}`],
    ["Inne", s.other],
  ].filter(([, v]) => v);

  return (
    <div className="space-y-8">
      <LiveRefresh topics={["content"]} />
      <PageTitle subtitle={t.tagline}>{t.name}</PageTitle>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {t.infoMd && (
            <Frame>
              <Markdown>{t.infoMd}</Markdown>
            </Frame>
          )}
          {t.formatMd && (
            <Frame>
              <Markdown>{t.formatMd}</Markdown>
            </Frame>
          )}
          <Frame title="Ustawienia gry">
            <dl className="divide-y divide-gold/10">
              {settings.map(([k, v]) => (
                <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-3">
                  <dt className="text-sm font-semibold text-cream-dim">{k}</dt>
                  <dd className="sm:col-span-2">{v}</dd>
                </div>
              ))}
            </dl>
          </Frame>
          {t.scheduleMd && (
            <Frame>
              <Markdown>{t.scheduleMd}</Markdown>
            </Frame>
          )}
        </div>
        <div className="space-y-8">
          {t.prizesMd && (
            <Frame>
              <Markdown>{t.prizesMd}</Markdown>
            </Frame>
          )}
          <Frame title="Szablony map">
            <ul className="space-y-3">
              {templates.map((m) => (
                <li key={m.id} className="stone rounded-sm border border-black px-3 py-2 shadow-[0_0_0_1px_var(--gold-dark)]">
                  <p className="font-display font-bold text-gold-light">{m.name}</p>
                  {m.description && <p className="text-sm text-cream-dim">{m.description}</p>}
                </li>
              ))}
            </ul>
          </Frame>
          <Frame title="Frakcje">
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-3">
              {FACTIONS.map((f) => (
                <li key={f.slug} className="flex flex-col items-center gap-1 text-center text-xs">
                  <FactionIcon slug={f.slug} hasImage={assets.factions.includes(`${f.slug}.png`)} size={40} />
                  <span>{f.name}</span>
                </li>
              ))}
            </ul>
          </Frame>
        </div>
      </div>
    </div>
  );
}
