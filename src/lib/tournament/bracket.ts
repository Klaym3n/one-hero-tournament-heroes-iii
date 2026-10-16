export type BracketMatchPlan = {
  key: string; // "r{round}-p{position}" lub "third"
  stage: "KNOCKOUT" | "THIRD_PLACE";
  round: number;
  position: number;
  bestOf: number;
  playerA: string | null;
  playerB: string | null;
  next: { key: string; slot: "A" | "B" } | null;
  loserNext: { key: string; slot: "A" | "B" } | null;
};

export type BestOfConfig = { knockout: number; final: number; thirdPlace: number };

/**
 * Pierwsza runda: zwycięzca grupy i vs drugi z grupy (i + G/2) mod G.
 * Dzięki temu gracze z tej samej grupy trafiają do przeciwnych połówek drabinki
 * i mogą spotkać się dopiero w finale.
 * @param qualifiers [zwycięzca, drugi] dla każdej grupy w kolejności A, B, …
 */
export function firstRoundPairs(qualifiers: [string, string][]): [string, string][] {
  const g = qualifiers.length;
  if (g === 0 || (g & (g - 1)) !== 0) throw new Error("Liczba grup musi być potęgą 2");
  if (g === 1) return [[qualifiers[0][0], qualifiers[0][1]]];
  const half = g / 2;
  return Array.from({ length: g }, (_, j) => [qualifiers[j][0], qualifiers[(j + half) % g][1]]);
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Finał";
  if (fromEnd === 1) return "Półfinał";
  if (fromEnd === 2) return "Ćwierćfinał";
  return `1/${2 ** fromEnd} finału`;
}

/** Plan drabinki pojedynczej eliminacji z meczem o 3. miejsce. */
export function planBracket(qualifiers: [string, string][], bo: BestOfConfig): BracketMatchPlan[] {
  const pairs = firstRoundPairs(qualifiers);
  const size = pairs.length * 2;
  const totalRounds = Math.log2(size);
  const plans: BracketMatchPlan[] = [];
  const key = (r: number, p: number) => `r${r}-p${p}`;
  const hasThird = size >= 4;

  for (let r = 1; r <= totalRounds; r++) {
    const count = size / 2 ** r;
    for (let p = 0; p < count; p++) {
      const isFinal = r === totalRounds;
      const isSemi = r === totalRounds - 1;
      plans.push({
        key: key(r, p),
        stage: "KNOCKOUT",
        round: r,
        position: p,
        bestOf: isFinal ? bo.final : bo.knockout,
        playerA: r === 1 ? pairs[p][0] : null,
        playerB: r === 1 ? pairs[p][1] : null,
        next: isFinal ? null : { key: key(r + 1, Math.floor(p / 2)), slot: p % 2 === 0 ? "A" : "B" },
        loserNext: isSemi && hasThird ? { key: "third", slot: p % 2 === 0 ? "A" : "B" } : null,
      });
    }
  }
  if (hasThird) {
    plans.push({
      key: "third",
      stage: "THIRD_PLACE",
      round: totalRounds,
      position: 1,
      bestOf: bo.thirdPlace,
      playerA: null,
      playerB: null,
      next: null,
      loserNext: null,
    });
  }
  return plans;
}
