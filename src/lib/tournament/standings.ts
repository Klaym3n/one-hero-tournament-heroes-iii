export type StandingMatch = {
  playerAId: string | null;
  playerBId: string | null;
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  /** tylko zakończone mecze (CONFIRMED / WALKOVER) wpływają na tabelę */
  finished: boolean;
};

export type StandingRow = {
  participantId: string;
  played: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
  rank: number;
  /** remis, którego nie da się rozstrzygnąć automatycznie – potrzebna decyzja admina */
  tied: boolean;
};

type Agg = Omit<StandingRow, "rank" | "tied">;

function aggregate(ids: string[], matches: StandingMatch[]): Map<string, Agg> {
  const set = new Set(ids);
  const map = new Map<string, Agg>(
    ids.map((id) => [id, { participantId: id, played: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, points: 0 }]),
  );
  for (const m of matches) {
    if (!m.finished || !m.winnerId || !m.playerAId || !m.playerBId) continue; // bez zwycięzcy = mecz anulowany
    if (!set.has(m.playerAId) || !set.has(m.playerBId)) continue;
    const a = map.get(m.playerAId)!;
    const b = map.get(m.playerBId)!;
    a.played++;
    b.played++;
    a.gamesWon += m.scoreA;
    a.gamesLost += m.scoreB;
    b.gamesWon += m.scoreB;
    b.gamesLost += m.scoreA;
    if (m.winnerId === m.playerAId) {
      a.wins++;
      a.points++;
      b.losses++;
    } else if (m.winnerId === m.playerBId) {
      b.wins++;
      b.points++;
      a.losses++;
    }
  }
  return map;
}

const diff = (r: Agg) => r.gamesWon - r.gamesLost;

/** Dzieli posortowaną listę na klastry o równym kluczu. */
function clusters<T>(items: T[], key: (t: T) => string): T[][] {
  const out: T[][] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && key(last[0]) === key(it)) last.push(it);
    else out.push([it]);
  }
  return out;
}

/**
 * Tabela grupy. Kolejność: punkty (wygrane serie) → bilans gier → mała tabela
 * (punkty i bilans w meczach między zainteresowanymi) → wygrane gry → ręczna kolejność admina.
 * Nierozstrzygnięte remisy oznaczane są flagą `tied`.
 */
export function computeStandings(
  participantIds: string[],
  matches: StandingMatch[],
  manualOrder?: string[] | null,
): StandingRow[] {
  const agg = aggregate(participantIds, matches);
  const rows = [...agg.values()].sort((x, y) => y.points - x.points || diff(y) - diff(x));
  const ordered: { row: Agg; tied: boolean }[] = [];

  for (const cluster of clusters(rows, (r) => `${r.points}|${diff(r)}`)) {
    if (cluster.length === 1) {
      ordered.push({ row: cluster[0], tied: false });
      continue;
    }
    const mini = aggregate(
      cluster.map((r) => r.participantId),
      matches,
    );
    const sorted = [...cluster].sort((x, y) => {
      const mx = mini.get(x.participantId)!;
      const my = mini.get(y.participantId)!;
      return my.points - mx.points || diff(my) - diff(mx) || y.gamesWon - x.gamesWon;
    });
    const key = (r: Agg) => {
      const m = mini.get(r.participantId)!;
      return `${m.points}|${diff(m)}|${r.gamesWon}`;
    };
    for (const sub of clusters(sorted, key)) {
      if (sub.length === 1) {
        ordered.push({ row: sub[0], tied: false });
      } else if (manualOrder && sub.every((r) => manualOrder.includes(r.participantId))) {
        sub.sort((x, y) => manualOrder.indexOf(x.participantId) - manualOrder.indexOf(y.participantId));
        for (const r of sub) ordered.push({ row: r, tied: false });
      } else {
        for (const r of sub) ordered.push({ row: r, tied: true });
      }
    }
  }

  return ordered.map(({ row, tied }, i) => ({ ...row, rank: i + 1, tied }));
}
