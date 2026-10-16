import type { Metadata } from "next";
import { connection } from "next/server";
import { Frame, Empty, PageTitle } from "@/components/ui/Frame";
import { Bracket, type BracketMatch } from "@/components/game/Bracket";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getTournament } from "@/lib/tournament/current";
import { getBracket, type MatchView } from "@/server/queries";

export const metadata: Metadata = { title: "Drabinka turniejowa" };

function toBracket(m: MatchView): BracketMatch {
  const side = (p: MatchView["a"]) => (p ? { id: p.id, nick: p.nick, avatarUrl: p.avatarUrl } : null);
  return {
    id: m.id,
    a: side(m.a),
    b: side(m.b),
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winnerId: m.winnerId,
    status: m.status,
    bestOf: m.bestOf,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
  };
}

export default async function BracketPage() {
  await connection();
  const t = await getTournament();
  const { rounds, third } = await getBracket(t.id);
  const finalMatch = rounds.at(-1)?.matches[0];
  const champion = finalMatch && (finalMatch.status === "CONFIRMED" || finalMatch.status === "WALKOVER") ? (finalMatch.winnerId === finalMatch.playerAId ? finalMatch.a : finalMatch.b) : null;

  return (
    <div>
      <LiveRefresh topics={["bracket"]} />
      <PageTitle subtitle="Pojedyncza eliminacja · mecze Bo3 · finał Bo5 · mecz o 3. miejsce">Drabinka turniejowa</PageTitle>
      {champion && (
        <div className="mb-8 text-center">
          <p className="text-sm tracking-widest text-cream-dim uppercase">Zwycięzca turnieju</p>
          <p className="title-gold mt-1 text-4xl font-black">🏆 {champion.nick}</p>
        </div>
      )}
      {rounds.length === 0 ? (
        <Frame className="mx-auto max-w-xl">
          <Empty>Drabinka zostanie wygenerowana po zakończeniu fazy grupowej.</Empty>
        </Frame>
      ) : (
        <Bracket rounds={rounds.map((r) => ({ round: r.round, name: r.name, matches: r.matches.map(toBracket) }))} third={third ? toBracket(third) : null} />
      )}
    </div>
  );
}
