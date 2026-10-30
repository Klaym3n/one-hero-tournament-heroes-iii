import Link from "next/link";
import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { Markdown } from "@/components/ui/Markdown";
import { MatchRow } from "@/components/game/MatchRow";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getPartners, getTournament } from "@/lib/tournament/current";
import { PartnersSection } from "@/components/layout/PartnersSection";
import { getSessionUser } from "@/lib/auth/session";
import { getAnnouncements, getParticipantByUser, recentResults, upcomingScheduled } from "@/server/queries";
import { PHASE_LABELS, fmtDate } from "@/lib/labels";

export default async function HomePage() {
  await connection();
  const t = await getTournament();
  const [user, news, upcoming, results, partners] = await Promise.all([
    getSessionUser(),
    getAnnouncements(t.id, 5),
    upcomingScheduled(t.id),
    recentResults(t.id),
    getPartners(t.id),
  ]);
  const me = user ? await getParticipantByUser(t.id, user.id) : null;
  const registered = me?.status === "ACTIVE";

  let cta: { href: string; label: string } | null = null;
  if (t.phase === "REGISTRATION_OPEN" && !registered) cta = { href: user ? "/konto/zapis" : "/logowanie?next=/konto/zapis", label: "Zapisz się do turnieju" };
  else if (registered) cta = { href: "/konto", label: "Moje mecze" };

  return (
    <div className="space-y-10">
      <LiveRefresh topics={["content", "matches", "players"]} />

      {/* Baner – logo One Hero Open (public/brand) na tle panelu albo na własnym banerze z panelu */}
      <section
        className="frame-sm panel overflow-hidden"
        style={t.bannerUrl ? { backgroundImage: `linear-gradient(180deg, rgba(12,10,20,.35), rgba(12,10,20,.95)), url(${t.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <div className="relative px-3 py-6 text-center sm:px-6 sm:py-8">
          <div className="relative">
            <span className="badge badge-gold mb-4">{PHASE_LABELS[t.phase]}</span>
            <h1>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/oho-logo-pelne.png" alt={t.name} width={2048} height={1697} className="mx-auto h-auto w-full max-w-[42rem] drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
            </h1>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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

      <PartnersSection partners={partners} invite={process.env.DISCORD_INVITE_URL} />
    </div>
  );
}
