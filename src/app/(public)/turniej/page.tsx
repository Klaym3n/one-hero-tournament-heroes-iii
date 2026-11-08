import type { Metadata } from "next";
import { connection } from "next/server";
import { Frame, PageTitle } from "@/components/ui/Frame";
import { MarkdownFrame } from "@/components/ui/MarkdownFrame";
import { DiscordIcon } from "@/components/ui/icons";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";
import { isOnDiscordServer } from "@/server/tournament";
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
  // w fazie przygotowań zapraszamy na serwer Discord (ogłoszenia o otwarciu zapisów)
  // tylko dla osób spoza serwera: niezalogowani i ci, których nie ma na serwerze (lub nie da się tego sprawdzić)
  let invite = t.phase === "DRAFT" ? env().DISCORD_INVITE_URL : "";
  if (invite) {
    const user = await getSessionUser();
    if (user && (await isOnDiscordServer(user)) === true) invite = "";
  }

  return (
    <div className="space-y-8">
      <LiveRefresh topics={["content"]} />
      <PageTitle subtitle={t.tagline}>{t.name}</PageTitle>
      <div className="grid gap-8 max-sm:grid-cols-1 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {t.infoMd && <MarkdownFrame md={t.infoMd} />}
          {showSettings && (
            <Frame title="Ustawienia gry">
              <dl className="divide-y divide-gold/10">
                {settings.map(([k, v]) => (
                  <div key={k} className="grid gap-1 py-2.5 max-sm:grid-cols-1 sm:grid-cols-3">
                    <dt className="text-sm font-semibold text-cream-dim">{k}</dt>
                    <dd className="sm:col-span-2">{v}</dd>
                  </div>
                ))}
              </dl>
            </Frame>
          )}
          {t.scheduleMd && <MarkdownFrame md={t.scheduleMd} />}
        </div>
        <div className="space-y-8">
          {t.prizesMd && <MarkdownFrame md={t.prizesMd} />}
          {invite && (
            <Frame title="Dołącz do społeczności">
              <div className="space-y-4 text-sm">
                <p>Zapisy jeszcze nie ruszyły. Dołącz do naszego serwera Discord.</p>
                <p className="text-cream-dim">Dołączenie do serwera Discord będzie wymagane, aby zapisać się do turnieju.</p>
                <a href={invite} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost w-fit">
                  <DiscordIcon /> Dołącz do Discorda
                </a>
              </div>
            </Frame>
          )}
        </div>
      </div>
    </div>
  );
}
