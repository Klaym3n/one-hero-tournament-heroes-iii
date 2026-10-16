import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Frame, PageTitle } from "@/components/ui/Frame";
import { ReportForm } from "@/components/report/ReportForm";
import { pageRequireUser } from "@/lib/authz";
import { getMatchDetail } from "@/server/queries";
import { getHeroes, getTemplates } from "@/lib/tournament/current";
import { getAssetManifest } from "@/lib/assets";

export const metadata: Metadata = { title: "Raport meczu" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await pageRequireUser(`/konto/mecze/${id}/raport`);
  const data = await getMatchDetail(id);
  if (!data) notFound();
  const m = data.match;
  const mySide = user.id === data.userA ? "A" : user.id === data.userB ? "B" : null;
  if (!mySide) notFound();

  const blocked =
    m.status === "CONFIRMED" || m.status === "WALKOVER"
      ? "Ten mecz jest już zatwierdzony."
      : m.status === "WAITING" || !m.playerAId || !m.playerBId
        ? "Mecz nie jest jeszcze gotowy do rozegrania."
        : null;

  const [templates, heroes, assets] = await Promise.all([getTemplates(m.tournamentId, true), getHeroes(true), getAssetManifest()]);
  const mine = data.reports.find((r) => r.status === "SUBMITTED" && r.submittedById === user.id);
  const theirs = data.reports.find((r) => r.status === "SUBMITTED" && r.submittedById !== user.id);

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle subtitle={`${m.label} · ${m.a?.nick} vs ${m.b?.nick}`}>Raport meczu</PageTitle>
      {blocked ? (
        <Frame>
          <p className="mb-4">{blocked}</p>
          <Link href={`/mecze/${m.id}`} className="btn">
            Wróć do meczu
          </Link>
        </Frame>
      ) : (
        <>
          {mine && (
            <p className="mb-4 rounded-sm border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
              Masz już złożony raport ({mine.scoreA}:{mine.scoreB}). Nowy raport zastąpi poprzedni.
            </p>
          )}
          {theirs && (
            <p className="mb-4 rounded-sm border border-crimson-light/50 bg-crimson/20 px-3 py-2 text-sm">
              Przeciwnik złożył już raport ({theirs.scoreA}:{theirs.scoreB}). Jeśli się z nim zgadzasz,{" "}
              <Link href={`/mecze/${m.id}`} className="text-gold-light underline">
                zaakceptuj go na stronie meczu
              </Link>
              . Złożenie własnego, innego raportu otworzy spór rozstrzygany przez moderatora.
            </p>
          )}
          <ReportForm
            matchId={m.id}
            bestOf={m.bestOf}
            nickA={m.a?.nick ?? "Gracz 1"}
            nickB={m.b?.nick ?? "Gracz 2"}
            mySide={mySide}
            templates={templates.map((t) => ({ id: t.id, name: t.name }))}
            heroes={heroes.map((h) => ({ slug: h.slug, name: h.name, faction: h.faction, heroClass: h.heroClass }))}
            assets={assets}
          />
        </>
      )}
    </div>
  );
}
