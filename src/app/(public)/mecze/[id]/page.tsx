import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/game/MatchRow";
import { ReportView } from "@/components/match/ReportView";
import { ConfirmReport, ProposalButton, ScheduleForm } from "@/components/match/MatchControls";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getMatchDetail } from "@/server/queries";
import { getSessionUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/authz";
import { getHeroes } from "@/lib/tournament/current";
import { getAssetManifest } from "@/lib/assets";
import { fmtDateTime, fmtTime, STAGE_LABELS } from "@/lib/labels";
import { toWarsawLocal } from "@/lib/time";

const UUID = /^[0-9a-f-]{36}$/i;
const REVISION_LABELS: Record<string, string> = {
  REPORT_SUBMITTED: "Złożono raport",
  REPORT_ACCEPTED: "Raport zaakceptowany przez przeciwnika",
  COUNTER_REPORT: "Złożono kontr-raport",
  DISPUTE_OPENED: "Zgłoszono spór",
  STAFF_ACCEPT: "Moderator zatwierdził raport",
  STAFF_EDIT: "Moderator skorygował wynik",
  WALKOVER: "Walkower",
  RESET: "Mecz zresetowany",
  SCHEDULE: "Zmiana terminu",
};

export const metadata: Metadata = { title: "Mecz" };

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getMatchDetail(id);
  if (!data) notFound();
  const { match: m } = data;
  const [user, heroes, assets] = await Promise.all([getSessionUser(), getHeroes(false), getAssetManifest()]);
  const heroNames = Object.fromEntries(heroes.map((h) => [h.slug, h.name]));

  const mySide = user ? (user.id === data.userA ? "A" : user.id === data.userB ? "B" : null) : null;
  const isStaff = hasRole(user, "MODERATOR");
  const done = m.status === "CONFIRMED" || m.status === "WALKOVER";
  const ready = Boolean(m.playerAId && m.playerBId) && m.status !== "WAITING";
  const pending = data.reports.find((r) => r.status === "SUBMITTED");
  const official = data.reports.find((r) => r.status === "ACCEPTED");
  const canSeeAll = Boolean(mySide) || isStaff;
  const visibleReports = canSeeAll ? data.reports : official ? [official] : [];
  const nickA = m.a?.nick ?? "TBD";
  const nickB = m.b?.nick ?? "TBD";

  return (
    <div className="space-y-8">
      <LiveRefresh topics={[`match:${m.id}`]} />

      <Frame bodyClassName="p-5 sm:p-8">
        <p className="mb-4 text-center text-sm text-cream-dim">
          {STAGE_LABELS[m.stage]} · {m.label} · Bo{m.bestOf}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-6">
          {[m.a, m.b].map((p, i) => {
            const isWinner = done && m.winnerId && m.winnerId === p?.id;
            const block = (
              <div key={i} className={`flex flex-col items-center gap-2 text-center ${i === 0 ? "sm:items-end sm:text-right" : "sm:items-start sm:text-left"}`}>
                <span className={`h-1 w-16 ${i === 0 ? "bg-red-player" : "bg-blue-player"}`} aria-hidden />
                <Avatar src={p?.avatarUrl} name={p?.nick ?? "?"} size={64} />
                {p ? (
                  <Link href={`/gracze/${p.id}`} className={`font-display text-lg font-bold hover:underline sm:text-2xl ${isWinner ? "text-gold-light" : ""}`}>
                    {p.nick}
                  </Link>
                ) : (
                  <span className="text-cream-dim italic">oczekuje na zwycięzcę</span>
                )}
                {isWinner && <span className="badge badge-gold">Zwycięzca</span>}
              </div>
            );
            return i === 0 ? (
              block
            ) : (
              <div key="pair" className="contents">
                <div className="self-center pt-6 text-center">
                  <p className="title-gold text-4xl font-black tabular-nums sm:text-6xl">{done ? `${m.scoreA}:${m.scoreB}` : "VS"}</p>
                  <div className="mt-2">
                    <StatusBadge status={m.status} />
                  </div>
                </div>
                {block}
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm">
          {m.scheduledAt ? (
            <>
              📅 Planowany start: <strong>{fmtDateTime(m.scheduledAt)}</strong> <span className="text-cream-dim">(czas polski)</span>
            </>
          ) : (
            !done && <span className="text-cream-dim">Termin nie został jeszcze ustalony.</span>
          )}
        </p>
      </Frame>

      {(mySide || isStaff) && ready && !done && (
        <div className="grid gap-8 md:grid-cols-2">
          <Frame title="Wynik meczu">
            {m.status === "DISPUTED" ? (
              <p className="text-sm">
                Mecz czeka na decyzję moderatora.{" "}
                {mySide && (
                  <Link className="text-gold-light underline" href={`/konto/mecze/${m.id}/raport`}>
                    Złóż własny raport
                  </Link>
                )}
              </p>
            ) : pending && mySide && pending.submittedById !== user!.id ? (
              <ConfirmReport reportId={pending.id} score={`${pending.scoreA}:${pending.scoreB}`} />
            ) : pending && mySide ? (
              <div className="space-y-3 text-sm">
                <p>Twój raport czeka na potwierdzenie przez przeciwnika.</p>
                <Link href={`/konto/mecze/${m.id}/raport`} className="btn btn-sm btn-ghost">
                  Popraw raport
                </Link>
              </div>
            ) : mySide ? (
              <div className="space-y-3">
                <p className="text-sm text-cream-dim">Po rozegraniu meczu jeden z graczy wypełnia raport, a drugi go potwierdza.</p>
                <Link href={`/konto/mecze/${m.id}/raport`} className="btn btn-primary">
                  Zgłoś wynik
                </Link>
              </div>
            ) : null}
            {isStaff && (
              <Link href={`/admin/raporty/${m.id}`} className="btn btn-sm btn-ghost mt-4">
                Moderuj mecz
              </Link>
            )}
          </Frame>
          <Frame title="Termin">
            <div className="space-y-5">
              <ScheduleForm matchId={m.id} current={m.scheduledAt ? toWarsawLocal(m.scheduledAt) : null} />
              <div>
                <h3 className="label">Wspólna dostępność</h3>
                {data.proposals.length === 0 ? (
                  <p className="text-sm text-cream-dim">
                    Brak wspólnych terminów.{" "}
                    {mySide && (
                      <Link href="/konto/dostepnosc" className="text-gold-light underline">
                        Uzupełnij swoją dostępność
                      </Link>
                    )}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.proposals.map((p) => {
                      const label = `${fmtDateTime(p.startsAt)}–${fmtTime(p.endsAt)}`;
                      return (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-black/25 px-3 py-2 text-sm">
                          <span>{label}</span>
                          {mySide && <ProposalButton matchId={m.id} startsAt={p.startsAt.toISOString()} label={label} />}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </Frame>
        </div>
      )}

      <Frame title={canSeeAll ? "Raporty" : "Raport meczu"}>
        {visibleReports.length === 0 ? (
          <Empty>{done && m.status === "WALKOVER" ? "Mecz rozstrzygnięty walkowerem." : "Brak raportu."}</Empty>
        ) : (
          <div className="space-y-4">
            {visibleReports.map((r) => (
              <ReportView key={r.id} report={r} playerAId={m.playerAId} nickA={nickA} nickB={nickB} heroNames={heroNames} assets={assets} />
            ))}
          </div>
        )}
      </Frame>

      {canSeeAll && (data.disputes.length > 0 || data.revisions.length > 0) && (
        <Frame title="Historia zmian">
          <ul className="space-y-2 text-sm">
            {data.disputes.map((d) => (
              <li key={d.id} className="rounded-sm border border-crimson/40 bg-crimson/10 px-3 py-2">
                <span className="badge badge-red mr-2">{d.status === "OPEN" ? "Spór otwarty" : "Spór zamknięty"}</span>
                {d.openedBy}: „{d.reason}”{d.resolution && <span className="block text-cream-dim">Decyzja: {d.resolution}</span>}
              </li>
            ))}
            {data.revisions.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-gold/10 pb-2">
                <span>
                  {REVISION_LABELS[r.action] ?? r.action}
                  {r.reason && <span className="text-cream-dim"> – {r.reason}</span>}
                </span>
                <span className="text-xs text-cream-dim">
                  {r.editor ?? "system"} · {fmtDateTime(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Frame>
      )}
    </div>
  );
}
