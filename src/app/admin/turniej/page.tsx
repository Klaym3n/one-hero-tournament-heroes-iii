import Link from "next/link";
import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { BracketGenerate, GroupDraw, PhaseButtons, ResetGroups, Tiebreak } from "@/components/admin/TournamentControls";
import { LiveRefresh } from "@/components/LiveRefresh";
import { pageRequireRole } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { groupVariants, loadGroupStandings } from "@/server/tournament";
import { playersById } from "@/server/queries";
import { PHASE_LABELS } from "@/lib/labels";
import type { Phase } from "@/db/schema";

const TRANSITIONS: Partial<Record<Phase, { to: Phase; label: string; confirm: string; primary?: boolean }[]>> = {
  DRAFT: [{ to: "REGISTRATION_OPEN", label: "Otwórz zapisy", confirm: "Otworzyć zapisy do turnieju?", primary: true }],
  REGISTRATION_OPEN: [
    { to: "REGISTRATION_CLOSED", label: "Zamknij zapisy", confirm: "Zamknąć zapisy? Nowi gracze nie będą mogli się zapisać.", primary: true },
    { to: "DRAFT", label: "Wróć do przygotowań", confirm: "Ukryć zapisy (faza przygotowań)?" },
  ],
  REGISTRATION_CLOSED: [{ to: "REGISTRATION_OPEN", label: "Otwórz zapisy ponownie", confirm: "Ponownie otworzyć zapisy?" }],
  KNOCKOUT: [{ to: "FINISHED", label: "Zakończ turniej", confirm: "Oznaczyć turniej jako zakończony?" }],
  FINISHED: [{ to: "KNOCKOUT", label: "Wznów fazę pucharową", confirm: "Przywrócić fazę pucharową?" }],
};

export default async function AdminTournamentPage() {
  await connection();
  await pageRequireRole("ADMIN");
  const t = await getTournament();
  const groups = t.phase === "GROUPS" ? await loadGroupStandings(t.id) : [];
  const { players, variants } = t.phase === "REGISTRATION_CLOSED" ? await groupVariants() : { players: 0, variants: [] };
  const nicks = await playersById(groups.flatMap((g) => g.standings.map((s) => s.participantId)));
  const incomplete = groups.reduce((a, g) => a + g.matches.filter((m) => !["CONFIRMED", "WALKOVER"].includes(m.status)).length, 0);
  const tiedGroups = groups.filter((g) => g.standings.slice(0, 3).some((r) => r.tied));

  return (
    <div className="space-y-6">
      <LiveRefresh topics={["groups", "players", "bracket"]} />
      <h1 className="title-gold text-3xl font-black">Turniej i fazy</h1>

      <Frame title={`Aktualna faza: ${PHASE_LABELS[t.phase]}`}>
        <ol className="mb-5 flex flex-wrap gap-2 text-xs">
          {(Object.keys(PHASE_LABELS) as Phase[]).map((p) => (
            <li key={p} className={`badge ${p === t.phase ? "badge-gold" : ""}`}>
              {PHASE_LABELS[p]}
            </li>
          ))}
        </ol>
        <PhaseButtons transitions={TRANSITIONS[t.phase] ?? []} />
      </Frame>

      {t.phase === "REGISTRATION_CLOSED" && (
        <Frame title="Losowanie grup">
          <GroupDraw players={players} variants={variants} />
        </Frame>
      )}

      {t.phase === "GROUPS" && (
        <>
          <Frame title="Faza grupowa → drabinka">
            <p className="mb-4 text-sm">
              Grup: {groups.length} · awansuje {groups.length * 2} graczy · niezakończonych meczów: <strong>{incomplete}</strong>.{" "}
              <Link href="/grupy" className="text-gold-light underline">
                Podgląd tabel
              </Link>
            </p>
            {tiedGroups.length > 0 && (
              <div className="mb-4 space-y-3">
                {tiedGroups.map((g) => (
                  <Tiebreak
                    key={g.group.id}
                    groupId={g.group.id}
                    groupName={g.group.name}
                    players={g.standings.map((s) => ({ id: s.participantId, nick: nicks.get(s.participantId)?.nick ?? "?" }))}
                  />
                ))}
              </div>
            )}
            <BracketGenerate ready={incomplete === 0 && tiedGroups.length === 0} incomplete={incomplete} />
          </Frame>
          <Frame title="Strefa niebezpieczna">
            <ResetGroups />
          </Frame>
        </>
      )}

      {(t.phase === "KNOCKOUT" || t.phase === "FINISHED") && (
        <Frame title="Faza pucharowa">
          <p className="text-sm">
            Drabinka jest aktywna – zwycięzcy przechodzą dalej automatycznie po zatwierdzeniu wyniku.{" "}
            <Link href="/drabinka" className="text-gold-light underline">
              Zobacz drabinkę
            </Link>
          </p>
        </Frame>
      )}
    </div>
  );
}
