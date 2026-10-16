import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { Avatar } from "@/components/ui/Avatar";
import { MatchRow } from "@/components/game/MatchRow";
import { LiveRefresh } from "@/components/LiveRefresh";
import { NotificationsList } from "@/components/account/NotificationsList";
import { pageRequireUser } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { getMyMatches, getNotifications, getParticipantByUser } from "@/server/queries";
import { PHASE_LABELS, ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Moje konto" };

export default async function AccountPage() {
  await connection();
  const user = await pageRequireUser("/konto");
  const t = await getTournament();
  const me = await getParticipantByUser(t.id, user.id);
  const [matches, notes] = await Promise.all([me ? getMyMatches(me.id) : null, getNotifications(user.id, 20)]);
  const name = user.discordGlobalName ?? user.discordUsername;
  const registered = me?.status === "ACTIVE";

  return (
    <div className="space-y-8">
      <LiveRefresh topics={[`user:${user.id}`, "matches", "groups", "bracket"]} />
      <Frame bodyClassName="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar src={user.avatarUrl} name={name} size={64} />
          <div className="flex-1">
            <h1 className="title-gold text-2xl font-black">{me?.nick ?? name}</h1>
            <p className="text-sm text-cream-dim">
              Discord: {user.discordUsername} · {ROLE_LABELS[user.role]} · Turniej: {PHASE_LABELS[t.phase]}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {me && (
              <Link href={`/gracze/${me.id}`} className="btn btn-sm btn-ghost">
                Profil publiczny
              </Link>
            )}
            <Link href="/konto/ustawienia" className="btn btn-sm">
              Ustawienia
            </Link>
            <Link href="/konto/dostepnosc" className="btn btn-sm">
              Dostępność
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="btn btn-sm btn-ghost">Wyloguj</button>
            </form>
          </div>
        </div>
      </Frame>

      {!registered && (
        <Frame title="Zapis do turnieju">
          {t.phase === "REGISTRATION_OPEN" ? (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>{me?.status === "WITHDRAWN" ? "Wypisałeś(-aś) się z turnieju. Możesz zapisać się ponownie." : "Nie jesteś jeszcze zapisany(-a) do turnieju."}</p>
              <Link href="/konto/zapis" className="btn btn-primary">
                Zapisz się
              </Link>
            </div>
          ) : me?.status === "BANNED" ? (
            <p>Twoje konto zostało wykluczone z turnieju.</p>
          ) : (
            <p className="text-cream-dim">Zapisy są obecnie zamknięte.</p>
          )}
        </Frame>
      )}

      {registered && matches && (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <Frame title="Mecze do rozegrania">
              {matches.open.length === 0 ? (
                <Empty>
                  {t.phase === "REGISTRATION_OPEN" || t.phase === "REGISTRATION_CLOSED" || t.phase === "DRAFT"
                    ? "Jesteś zapisany(-a)! Mecze pojawią się po losowaniu grup."
                    : "Brak meczów do rozegrania."}
                </Empty>
              ) : (
                <div className="space-y-2">
                  {matches.open.map((m) => (
                    <MatchRow key={m.id} m={m} />
                  ))}
                </div>
              )}
              {matches.waiting.length > 0 && (
                <p className="mt-4 text-sm text-cream-dim">Czekasz na przeciwnika w {matches.waiting.length} meczu(-ach) drabinki.</p>
              )}
            </Frame>
            <Frame title="Rozegrane">
              {matches.done.length === 0 ? (
                <Empty>Brak rozegranych meczów.</Empty>
              ) : (
                <div className="space-y-2">
                  {matches.done.map((m) => (
                    <MatchRow key={m.id} m={m} perspective={me!.id} />
                  ))}
                </div>
              )}
            </Frame>
          </div>
          <NotificationsList notes={notes} />
        </div>
      )}
      {!registered && <NotificationsList notes={notes} />}
    </div>
  );
}
