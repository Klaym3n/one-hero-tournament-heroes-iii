import Link from "next/link";
import type { StandingRow } from "@/lib/tournament/standings";
import type { PlayerLite, MatchView } from "@/server/queries";
import { Avatar } from "@/components/ui/Avatar";
import { MatchRow } from "./MatchRow";

type Props = {
  name: string;
  standings: StandingRow[];
  players: Map<string, PlayerLite>;
  matches: MatchView[];
  highlight?: string | null;
};

export function GroupTable({ name, standings, players, matches, highlight }: Props) {
  const done = matches.filter((m) => m.status === "CONFIRMED" || m.status === "WALKOVER").length;
  return (
    <section className="frame-sm panel" aria-label={`Grupa ${name}`}>
      <header className="frame-header flex items-center justify-between px-4 py-2">
        <h2 className="font-display text-lg font-black text-gold-light">Grupa {name}</h2>
        <span className="text-xs text-cream-dim">
          {done}/{matches.length} meczów
        </span>
      </header>
      <div className="scroll-x">
        <table className="table-h3 min-w-[420px]">
          <thead>
            <tr>
              <th className="w-8 text-center">#</th>
              <th>Gracz</th>
              <th className="num" title="Rozegrane">M</th>
              <th className="num" title="Wygrane">W</th>
              <th className="num" title="Przegrane">P</th>
              <th className="num" title="Bilans gier">Gry</th>
              <th className="num" title="Punkty">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((r) => {
              const p = players.get(r.participantId);
              const advancing = r.rank <= 2;
              return (
                <tr key={r.participantId} className={highlight === r.participantId ? "bg-gold/10" : undefined}>
                  <td className="text-center">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-sm border border-black font-display text-xs font-bold ${
                        advancing ? "bg-emerald text-white shadow-[0_0_0_1px_var(--gold-dark)]" : "bg-black/30 text-cream-dim"
                      }`}
                      title={advancing ? "Miejsce premiowane awansem" : undefined}
                    >
                      {r.rank}
                    </span>
                  </td>
                  <td>
                    <Link href={`/gracze/${r.participantId}`} className="flex items-center gap-2 hover:text-gold-light">
                      <Avatar src={p?.avatarUrl} name={p?.nick ?? "?"} size={22} />
                      <span className={`truncate font-semibold ${p && p.status !== "ACTIVE" ? "line-through opacity-60" : ""}`}>{p?.nick ?? "?"}</span>
                      {r.tied && (
                        <span className="badge badge-red" title="Remis do rozstrzygnięcia przez organizatora">
                          remis
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="num">{r.played}</td>
                  <td className="num">{r.wins}</td>
                  <td className="num">{r.losses}</td>
                  <td className="num">
                    {r.gamesWon}:{r.gamesLost}
                  </td>
                  <td className="num font-display font-bold text-gold-light">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details className="border-t border-gold/15 px-3 py-2">
        <summary className="cursor-pointer py-1 text-sm font-semibold text-cream-dim hover:text-gold-light">Mecze grupy</summary>
        <div className="mt-2 space-y-2 pb-1">
          {[...matches]
            .sort((a, b) => (a.groupRound ?? 0) - (b.groupRound ?? 0))
            .map((m) => (
              <MatchRow key={m.id} m={m} />
            ))}
        </div>
      </details>
    </section>
  );
}
