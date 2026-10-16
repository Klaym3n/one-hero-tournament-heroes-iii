import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { Avatar } from "@/components/ui/Avatar";
import { StreamIcon } from "@/components/ui/icons";
import { MatchRow } from "@/components/game/MatchRow";
import { FactionIcon } from "@/components/game/FactionIcon";
import { HeroPortrait } from "@/components/game/HeroPortrait";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPlayerProfile } from "@/server/queries";
import { loadGroupStandings } from "@/server/tournament";
import { FACTION_BY_SLUG, type FactionSlug } from "@/data/factions";
import { getAssetManifest } from "@/lib/assets";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Gracz" };
  const p = await getPlayerProfile(id);
  return { title: p ? p.participant.nick : "Gracz" };
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const profile = await getPlayerProfile(id);
  if (!profile) notFound();
  const { participant: p, stats } = profile;
  const assets = await getAssetManifest();

  let groupPosition: { name: string; rank: number; size: number } | null = null;
  if (profile.group) {
    const all = await loadGroupStandings(p.tournamentId);
    const g = all.find((x) => x.group.id === profile.group!.groupId);
    const row = g?.standings.find((s) => s.participantId === p.id);
    if (g && row) groupPosition = { name: g.group.name, rank: row.rank, size: g.standings.length };
  }
  const lastKo = profile.knockout.filter((m) => m.stage === "KNOCKOUT").sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0];
  const streams = [
    ["youtube", p.youtubeUrl, "YouTube"],
    ["twitch", p.twitchUrl, "Twitch"],
    ["kick", p.kickUrl, "Kick"],
  ].filter(([, url]) => url) as ["youtube" | "twitch" | "kick", string, string][];

  return (
    <div className="space-y-8">
      <LiveRefresh topics={["players", "matches"]} />
      <Frame bodyClassName="p-5 sm:p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <Avatar src={profile.avatarUrl} name={p.nick} size={96} />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="title-gold text-3xl font-black">{p.nick}</h1>
            <p className="text-sm text-cream-dim">Discord: {profile.discordName}</p>
            {p.status !== "ACTIVE" && <span className="badge badge-red mt-2">{p.status === "BANNED" ? "Wykluczony" : "Wycofany"}</span>}
            {p.bio && <p className="mt-3 max-w-xl">{p.bio}</p>}
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {groupPosition && (
                <Link href="/grupy" className="badge badge-gold">
                  Grupa {groupPosition.name}: {groupPosition.rank}. miejsce
                </Link>
              )}
              {lastKo && (
                <Link href="/drabinka" className="badge badge-blue">
                  Puchar: {lastKo.label}
                  {lastKo.status === "CONFIRMED" || lastKo.status === "WALKOVER" ? (lastKo.winnerId === p.id ? " – wygrana" : " – odpadł(a)") : ""}
                </Link>
              )}
            </div>
            {streams.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                {streams.map(([kind, url, label]) => (
                  <a key={kind} href={url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-sm">
                    <StreamIcon kind={kind} /> {label}
                  </a>
                ))}
              </div>
            )}
          </div>
          <dl className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            {[
              ["Mecze W", stats.wins],
              ["Mecze P", stats.losses],
              ["Gry W", stats.gamesWon],
              ["Gry P", stats.gamesLost],
            ].map(([k, v]) => (
              <div key={k} className="stone min-w-24 rounded-sm border border-black px-3 py-2 text-center shadow-[0_0_0_1px_var(--gold-dark)]">
                <dt className="text-[10px] tracking-widest text-cream-dim uppercase">{k}</dt>
                <dd className="font-display text-2xl font-bold text-gold-light">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Frame>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Frame title="Nadchodzące pojedynki">
            {profile.upcoming.length === 0 ? (
              <Empty>Brak meczów do rozegrania.</Empty>
            ) : (
              <div className="space-y-2">
                {profile.upcoming.map((m) => (
                  <MatchRow key={m.id} m={m} />
                ))}
              </div>
            )}
          </Frame>
          <Frame title="Historia meczów">
            {profile.played.length === 0 ? (
              <Empty>Brak rozegranych meczów.</Empty>
            ) : (
              <div className="space-y-2">
                {profile.played.map((m) => (
                  <MatchRow key={m.id} m={m} perspective={p.id} />
                ))}
              </div>
            )}
          </Frame>
        </div>
        <div className="space-y-8">
          <Frame title="Ulubione frakcje">
            {stats.factions.length === 0 ? (
              <Empty>Brak danych z raportów.</Empty>
            ) : (
              <ul className="space-y-2">
                {stats.factions.map((f) => (
                  <li key={f.slug} className="flex items-center gap-3">
                    <FactionIcon slug={f.slug} hasImage={assets.factions.includes(`${f.slug}.png`)} size={30} />
                    <span className="flex-1">{FACTION_BY_SLUG[f.slug as FactionSlug]?.name ?? f.slug}</span>
                    <span className="text-sm text-cream-dim">
                      {f.games} gier · {Math.round((f.wins / f.games) * 100)}% W
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Frame>
          <Frame title="Najczęstsi bohaterowie">
            {stats.heroes.length === 0 ? (
              <Empty>Brak danych z raportów.</Empty>
            ) : (
              <ul className="space-y-2">
                {stats.heroes.map((h) => (
                  <li key={h.slug} className="flex items-center gap-3">
                    <HeroPortrait slug={h.slug} name={h.hero?.name ?? h.slug} faction={h.hero?.faction ?? ""} hasImage={assets.heroes.includes(`${h.slug}.png`)} size={30} />
                    <span className="flex-1">{h.hero?.name ?? h.slug}</span>
                    <span className="text-sm text-cream-dim">{h.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </Frame>
        </div>
      </div>
    </div>
  );
}
