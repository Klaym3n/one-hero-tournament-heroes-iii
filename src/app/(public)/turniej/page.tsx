import type { Metadata } from "next";
import { connection } from "next/server";
import { Frame, PageTitle } from "@/components/ui/Frame";
import { Markdown } from "@/components/ui/Markdown";
import { getTournament } from "@/lib/tournament/current";
import { LiveRefresh } from "@/components/LiveRefresh";
import { GAME_SETTING_FIELDS, normalizeGameSettings } from "@/lib/tournament/game-settings";

export const metadata: Metadata = { title: "Informacje o turnieju" };

export default async function TournamentInfoPage() {
  await connection();
  const t = await getTournament();
  const s = normalizeGameSettings(t.gameSettings);
  const settings = GAME_SETTING_FIELDS.map((f) => [f.label, s[f.key]] as const).filter(([, v]) => v);
  // ustawienia gry pokazujemy dopiero od otwarcia zapisów
  const showSettings = t.phase !== "DRAFT" && settings.length > 0;

  return (
    <div className="space-y-8">
      <LiveRefresh topics={["content"]} />
      <PageTitle subtitle={t.tagline}>{t.name}</PageTitle>
      <div className="grid gap-8 max-sm:grid-cols-1 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {t.infoMd && (
            <Frame>
              <Markdown>{t.infoMd}</Markdown>
            </Frame>
          )}
          {showSettings && (
            <Frame>
              {/* nagłówek w tym samym stylu co sekcje markdown (## …) */}
              <div className="prose-h3">
                <h2>Ustawienia gry</h2>
                <dl className="divide-y divide-gold/10">
                  {settings.map(([k, v]) => (
                    <div key={k} className="grid gap-1 py-2.5 max-sm:grid-cols-1 sm:grid-cols-3">
                      <dt className="text-sm font-semibold text-cream-dim">{k}</dt>
                      <dd className="sm:col-span-2">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Frame>
          )}
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
        </div>
      </div>
    </div>
  );
}
