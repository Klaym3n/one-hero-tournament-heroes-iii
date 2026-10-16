import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { StatusBadge } from "@/components/game/MatchRow";
import { ReportView } from "@/components/match/ReportView";
import { AcceptReport, StaffResultEditor, StaffSchedule, WalkoverReset } from "@/components/admin/ModerationControls";
import { LiveRefresh } from "@/components/LiveRefresh";
import { pageRequireRole } from "@/lib/authz";
import { getMatchDetail } from "@/server/queries";
import { getHeroes, getTemplates } from "@/lib/tournament/current";
import { getAssetManifest } from "@/lib/assets";
import { fmtDateTime } from "@/lib/labels";
import { toWarsawLocal } from "@/lib/time";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ModerateMatchPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await pageRequireRole("MODERATOR");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getMatchDetail(id);
  if (!data) notFound();
  const m = data.match;
  const [templates, heroes, allHeroes, assets] = await Promise.all([getTemplates(m.tournamentId, true), getHeroes(true), getHeroes(false), getAssetManifest()]);
  const heroNames = Object.fromEntries(allHeroes.map((h) => [h.slug, h.name]));
  const nickA = m.a?.nick ?? "TBD";
  const nickB = m.b?.nick ?? "TBD";
  const ready = Boolean(m.playerAId && m.playerBId);
  const done = m.status === "CONFIRMED" || m.status === "WALKOVER";
  const openDispute = data.disputes.find((d) => d.status === "OPEN");

  return (
    <div className="space-y-6">
      <LiveRefresh topics={[`match:${m.id}`]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/raporty" className="text-sm text-cream-dim hover:text-gold-light">
            ← Raporty
          </Link>
          <h1 className="title-gold text-2xl font-black">
            {nickA} vs {nickB}
          </h1>
          <p className="text-sm text-cream-dim">
            {m.label} · Bo{m.bestOf} · {done ? `wynik ${m.scoreA}:${m.scoreB}` : "nierozstrzygnięty"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={m.status} />
          <Link href={`/mecze/${m.id}`} className="btn btn-sm btn-ghost">
            Strona publiczna
          </Link>
        </div>
      </div>

      {openDispute && (
        <Frame title="Spór">
          <p>
            <strong>{openDispute.openedBy}</strong> ({fmtDateTime(openDispute.createdAt)}): „{openDispute.reason}”
          </p>
          <p className="mt-2 text-sm text-cream-dim">Porównaj raporty poniżej i zatwierdź właściwy albo wprowadź wynik samodzielnie.</p>
        </Frame>
      )}

      <Frame title="Raporty">
        {data.reports.length === 0 ? (
          <Empty>Brak raportów.</Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.reports.map((r) => (
              <div key={r.id} className="space-y-2">
                <ReportView report={r} playerAId={m.playerAId} nickA={nickA} nickB={nickB} heroNames={heroNames} assets={assets} />
                {(r.status === "SUBMITTED" || (r.status === "REJECTED" && done)) && <AcceptReport reportId={r.id} label={`${r.scoreA}:${r.scoreB}`} />}
              </div>
            ))}
          </div>
        )}
      </Frame>

      {ready && (
        <Frame title="Wynik ustalony przez moderatora">
          <StaffResultEditor
            matchId={m.id}
            bestOf={m.bestOf}
            nickA={nickA}
            nickB={nickB}
            templates={templates.map((t) => ({ id: t.id, name: t.name }))}
            heroes={heroes.map((h) => ({ slug: h.slug, name: h.name, faction: h.faction, heroClass: h.heroClass }))}
            assets={assets}
          />
        </Frame>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {ready && (
          <Frame title="Walkower / reset">
            <WalkoverReset matchId={m.id} nickA={nickA} nickB={nickB} canReset={m.status !== "PENDING"} />
          </Frame>
        )}
        {!done && (
          <Frame title="Termin (transmisja)">
            <StaffSchedule matchId={m.id} current={m.scheduledAt ? toWarsawLocal(m.scheduledAt) : null} />
          </Frame>
        )}
      </div>

      <Frame title="Historia zmian">
        {data.revisions.length === 0 ? (
          <Empty>Brak wpisów.</Empty>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.revisions.map((r) => (
              <li key={r.id} className="border-b border-gold/10 pb-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{r.action}</span>
                  <span className="text-xs text-cream-dim">
                    {r.editor ?? "system"} · {fmtDateTime(r.createdAt)}
                  </span>
                </div>
                {r.reason && <p className="text-cream-dim">Powód: {r.reason}</p>}
                <details className="text-xs text-cream-dim">
                  <summary className="cursor-pointer">Szczegóły</summary>
                  <pre className="mt-1 overflow-x-auto rounded-sm bg-black/40 p-2">{JSON.stringify({ przed: r.before, po: r.after }, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Frame>
    </div>
  );
}
