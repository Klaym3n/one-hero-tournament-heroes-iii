import Link from "next/link";
import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { Markdown } from "@/components/ui/Markdown";
import { MatchRow } from "@/components/game/MatchRow";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getTournament } from "@/lib/tournament/current";
import { getSessionUser } from "@/lib/auth/session";
import { countPlayers, getAnnouncements, getParticipantByUser, recentResults, upcomingScheduled } from "@/server/queries";
import { PHASE_LABELS, fmtDate } from "@/lib/labels";
import { FACTIONS } from "@/data/factions";
import { FactionIcon } from "@/components/game/FactionIcon";
import { getAssetManifest } from "@/lib/assets";

export default async function HomePage() {
  await connection();
  const t = await getTournament();
  const [user, players, news, upcoming, results, assets] = await Promise.all([
    getSessionUser(),
    countPlayers(t.id),
    getAnnouncements(t.id, 5),
    upcomingScheduled(t.id),
    recentResults(t.id),
    getAssetManifest(),
  ]);
  const me = user ? await getParticipantByUser(t.id, user.id) : null;
  const registered = me?.status === "ACTIVE";

  let cta: { href: string; label: string } | null = null;
  if (t.phase === "REGISTRATION_OPEN" && !registered) cta = { href: user ? "/konto/zapis" : "/logowanie?next=/konto/zapis", label: "Zapisz się do turnieju" };
  else if (registered) cta = { href: "/konto", label: "Moje mecze" };

  return (
    <div className="space-y-10">
      <LiveRefresh topics={["content", "matches", "players"]} />

      {/* Baner */}
      <section
        className="frame overflow-hidden"
        style={t.bannerUrl ? { backgroundImage: `linear-gradient(180deg, rgba(12,10,20,.35), rgba(12,10,20,.95)), url(${t.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <span className="corner-bl" aria-hidden />
        <span className="corner-br" aria-hidden />
        <div className="relative px-5 py-12 text-center sm:px-10 sm:py-16">
          <div className="relative">
            <span className="badge badge-gold mb-4">{PHASE_LABELS[t.phase]}</span>
            <h1 className="title-gold text-4xl leading-tight font-black sm:text-6xl">{t.name}</h1>
            <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2 opacity-80" aria-hidden>
              {FACTIONS.map((f) => (
                <FactionIcon key={f.slug} slug={f.slug} hasImage={assets.factions.includes(`${f.slug}.png`)} size={30} title={false} />
              ))}
            </div>
            {t.tagline && <p className="mx-auto mt-4 max-w-2xl text-lg text-cream">{t.tagline}</p>}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {cta && (
                <Link href={cta.href} className="btn btn-primary px-6 text-base">
                  {cta.label}
                </Link>
              )}
              <Link href="/turniej" className="btn">
                Zasady i format
              </Link>
              {(t.phase === "GROUPS" || t.phase === "KNOCKOUT" || t.phase === "FINISHED") && (
                <Link href={t.phase === "GROUPS" ? "/grupy" : "/drabinka"} className="btn">
                  {t.phase === "GROUPS" ? "Tabele grup" : "Drabinka"}
                </Link>
              )}
            </div>
            <dl className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-3 text-center">
              {[
                ["Graczy", players],
                ["Format", "Bo3 / Bo5"],
                ["Frakcje", FACTIONS.length],
              ].map(([k, v]) => (
                <div key={k} className="stone rounded-sm border border-black px-2 py-3 shadow-[0_0_0_1px_var(--gold-dark)]">
                  <dt className="text-[11px] tracking-widest text-cream-dim uppercase">{k}</dt>
                  <dd className="font-display text-xl font-bold text-gold-light">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Frame title="Aktualności">
            {news.length === 0 ? (
              <Empty>Brak ogłoszeń.</Empty>
            ) : (
              <ul className="space-y-6">
                {news.map((n) => (
                  <li key={n.id} className="border-b border-gold/10 pb-5 last:border-0 last:pb-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {n.pinned && <span className="badge badge-gold">Przypięte</span>}
                      <h3 className="font-display text-lg font-bold text-gold-light">{n.title}</h3>
                      <span className="text-xs text-cream-dim">{fmtDate(n.createdAt)}</span>
                    </div>
                    <Markdown>{n.bodyMd}</Markdown>
                  </li>
                ))}
              </ul>
            )}
          </Frame>
        </div>
        <div className="space-y-8">
          <Frame title="Nadchodzące mecze">
            {upcoming.length === 0 ? <Empty>Brak zaplanowanych meczów.</Empty> : <div className="space-y-2">{upcoming.map((m) => <MatchRow key={m.id} m={m} />)}</div>}
          </Frame>
          <Frame title="Ostatnie wyniki">
            {results.length === 0 ? <Empty>Jeszcze nikt nie zagrał.</Empty> : <div className="space-y-2">{results.map((m) => <MatchRow key={m.id} m={m} />)}</div>}
          </Frame>
        </div>
      </div>
    </div>
  );
}
