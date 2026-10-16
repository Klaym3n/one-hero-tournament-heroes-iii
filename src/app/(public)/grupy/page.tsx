import type { Metadata } from "next";
import { connection } from "next/server";
import { Frame, Empty, PageTitle } from "@/components/ui/Frame";
import { GroupTable } from "@/components/game/GroupTable";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getTournament } from "@/lib/tournament/current";
import { loadGroupStandings } from "@/server/tournament";
import { decorateMatches, getParticipantByUser, playersById } from "@/server/queries";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Faza grupowa" };

export default async function GroupsPage() {
  await connection();
  const t = await getTournament();
  const data = await loadGroupStandings(t.id);
  const user = await getSessionUser();
  const me = user ? await getParticipantByUser(t.id, user.id) : null;

  if (!data.length) {
    return (
      <>
        <PageTitle>Faza grupowa</PageTitle>
        <Frame className="mx-auto max-w-xl">
          <Empty>Grupy nie zostały jeszcze wylosowane. Losowanie odbędzie się po zamknięciu zapisów.</Empty>
        </Frame>
      </>
    );
  }

  const players = await playersById(data.flatMap((d) => d.standings.map((s) => s.participantId)));
  const views = await decorateMatches(data.flatMap((d) => d.matches));
  const byGroup = new Map<string, typeof views>();
  for (const v of views) byGroup.set(v.groupId!, [...(byGroup.get(v.groupId!) ?? []), v]);

  return (
    <div>
      <LiveRefresh topics={["groups", "players"]} />
      <PageTitle subtitle="Każdy z każdym, mecze Bo3. Awans: 2 najlepsze osoby z każdej grupy. Tabele aktualizują się na żywo.">Faza grupowa</PageTitle>
      <div className="grid gap-8 md:grid-cols-2">
        {data.map((d) => (
          <GroupTable
            key={d.group.id}
            name={d.group.name}
            standings={d.standings}
            players={players}
            matches={byGroup.get(d.group.id) ?? []}
            highlight={me?.id}
          />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-cream-dim">
        Kolejność: punkty (wygrane mecze) → bilans gier → mała tabela (mecze bezpośrednie) → decyzja organizatora.
      </p>
    </div>
  );
}
