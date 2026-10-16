import { describe, expect, it } from "vitest";
import { drawGroups, groupName, proposeGroupVariants, roundRobin } from "./groups";
import { computeStandings, type StandingMatch } from "./standings";
import { firstRoundPairs, planBracket } from "./bracket";
import { validateReport, type ReportContext } from "./report";

const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;

describe("proposeGroupVariants", () => {
  it("dla każdego N 8…200 zwraca poprawne warianty", () => {
    for (let n = 8; n <= 200; n++) {
      const variants = proposeGroupVariants(n);
      expect(variants.length, `N=${n}`).toBeGreaterThan(0);
      for (const v of variants) {
        expect(isPow2(v.groupCount)).toBe(true);
        expect(v.sizes.reduce((a, b) => a + b, 0)).toBe(n);
        expect(v.advancing).toBe(v.groupCount * 2);
        expect(Math.max(...v.sizes) - Math.min(...v.sizes)).toBeLessThanOrEqual(1);
        if (!v.outOfRange) {
          expect(Math.min(...v.sizes)).toBeGreaterThanOrEqual(4);
          expect(Math.max(...v.sizes)).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it("50 graczy → 8 grup po 6/7 nie mieści się, wybierane najbliższe", () => {
    const v = proposeGroupVariants(50);
    // 8 grup: 6×6 + 2×7 (poza zakresem) lub 16 grup: 3/4 (poza zakresem)
    expect(v.every((x) => x.outOfRange)).toBe(true);
  });

  it("40 graczy → 8 grup po 5", () => {
    const v = proposeGroupVariants(40);
    expect(v.map((x) => x.groupCount)).toEqual([8]);
    expect(v[0].sizes).toEqual([5, 5, 5, 5, 5, 5, 5, 5]);
  });

  it("64 graczy → 16 grup po 4 (oraz brak 8 grup po 8)", () => {
    const v = proposeGroupVariants(64);
    expect(v.map((x) => x.groupCount)).toEqual([16]);
  });

  it("48 graczy → 8 grup po 6", () => {
    expect(proposeGroupVariants(48).map((x) => x.groupCount)).toEqual([8]);
  });
});

describe("drawGroups / roundRobin", () => {
  it("losuje wszystkich graczy dokładnie raz", () => {
    const players = Array.from({ length: 37 }, (_, i) => `p${i}`);
    const groups = drawGroups(players, [5, 5, 5, 5, 5, 4, 4, 4]);
    expect(groups.map((g) => g.length)).toEqual([5, 5, 5, 5, 5, 4, 4, 4]);
    expect(new Set(groups.flat()).size).toBe(37);
  });

  it.each([3, 4, 5, 6, 7])("round robin %i graczy: każda para raz", (size) => {
    const rounds = roundRobin(size);
    const pairs = rounds.flat().map(([a, b]) => [a, b].sort().join("-"));
    expect(pairs.length).toBe((size * (size - 1)) / 2);
    expect(new Set(pairs).size).toBe(pairs.length);
    // nikt nie gra dwa razy w jednej kolejce
    for (const r of rounds) {
      const ids = r.flat();
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("nazwy grup", () => {
    expect([0, 1, 25, 26, 27].map(groupName)).toEqual(["A", "B", "Z", "AA", "AB"]);
  });
});

describe("computeStandings", () => {
  const m = (a: string, b: string, sa: number, sb: number): StandingMatch => ({
    playerAId: a,
    playerBId: b,
    scoreA: sa,
    scoreB: sb,
    winnerId: sa > sb ? a : b,
    finished: true,
  });

  it("sortuje wg punktów i bilansu gier", () => {
    const rows = computeStandings(["a", "b", "c", "d"], [
      m("a", "b", 2, 0),
      m("a", "c", 2, 1),
      m("a", "d", 2, 0),
      m("b", "c", 2, 0),
      m("b", "d", 0, 2),
      m("c", "d", 2, 0),
    ]);
    // a 3 pkt; b, c, d po 1 pkt; c bilans -1, b i d po -2 → d wygrało z b bezpośrednio
    expect(rows.map((r) => r.participantId)).toEqual(["a", "c", "d", "b"]);
    expect(rows[0].points).toBe(3);
  });

  it("bezpośredni mecz rozstrzyga remis punktów i bilansu", () => {
    const rows = computeStandings(["a", "b", "c"], [m("a", "b", 2, 1), m("b", "c", 2, 1), m("c", "a", 2, 1)]);
    // wszyscy 1 pkt i bilans 0 → mała tabela też równa → remis
    expect(rows.every((r) => r.tied)).toBe(true);
    const manual = computeStandings(["a", "b", "c"], [m("a", "b", 2, 1), m("b", "c", 2, 1), m("c", "a", 2, 1)], ["c", "a", "b"]);
    expect(manual.map((r) => r.participantId)).toEqual(["c", "a", "b"]);
    expect(manual.some((r) => r.tied)).toBe(false);
  });

  it("dwóch graczy z równymi punktami i bilansem – decyduje bezpośredni mecz", () => {
    const rows = computeStandings(["a", "b", "c", "d"], [
      m("a", "b", 1, 2), // b wygrywa h2h
      m("a", "c", 2, 0),
      m("b", "d", 2, 1),
      m("a", "d", 2, 0),
      m("b", "c", 1, 2),
      m("c", "d", 0, 2),
    ]);
    // a: 2 pkt, gry 5-2 (+3); b: 2 pkt, 5-4 (+1) → różny bilans, a przed b
    expect(rows[0].participantId).toBe("a");
  });

  it("ignoruje niezakończone mecze", () => {
    const rows = computeStandings(["a", "b"], [{ ...m("a", "b", 2, 0), finished: false }]);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });
});

describe("bracket", () => {
  const quals = (g: number) => Array.from({ length: g }, (_, i) => [`W${i}`, `R${i}`] as [string, string]);

  it.each([2, 4, 8, 16, 32])("%i grup: gracze z tej samej grupy w przeciwnych połówkach", (g) => {
    const pairs = firstRoundPairs(quals(g));
    expect(pairs.length).toBe(g);
    const half = g / 2;
    for (let i = 0; i < g; i++) {
      const wPos = pairs.findIndex((p) => p[0] === `W${i}`);
      const rPos = pairs.findIndex((p) => p[1] === `R${i}`);
      expect(wPos < half).not.toBe(rPos < half);
    }
  });

  it("plan drabinki 8 grup: 16 graczy, 15 meczów + o 3. miejsce", () => {
    const plan = planBracket(quals(8), { knockout: 3, final: 5, thirdPlace: 3 });
    const ko = plan.filter((p) => p.stage === "KNOCKOUT");
    expect(ko.length).toBe(15);
    expect(plan.filter((p) => p.stage === "THIRD_PLACE").length).toBe(1);
    const final = ko.find((p) => p.next === null)!;
    expect(final.bestOf).toBe(5);
    expect(final.round).toBe(4);
    // każdy mecz poza finałem ma następnika; do każdego meczu rundy >1 trafiają dokładnie 2 mecze
    const keys = new Set(plan.map((p) => p.key));
    for (const p of ko.filter((x) => x.round > 1)) {
      const feeders = ko.filter((x) => x.next?.key === p.key);
      expect(feeders.map((f) => f.next!.slot).sort()).toEqual(["A", "B"]);
    }
    for (const p of plan) if (p.next) expect(keys.has(p.next.key)).toBe(true);
    const semis = ko.filter((p) => p.loserNext);
    expect(semis.length).toBe(2);
    expect(semis.map((s) => s.loserNext!.slot).sort()).toEqual(["A", "B"]);
  });

  it("1 grupa: tylko finał, bez meczu o 3. miejsce", () => {
    const plan = planBracket(quals(1), { knockout: 3, final: 5, thirdPlace: 3 });
    expect(plan.length).toBe(1);
    expect(plan[0].bestOf).toBe(5);
  });

  it("odrzuca liczbę grup niebędącą potęgą 2", () => {
    expect(() => firstRoundPairs(quals(3))).toThrow();
  });
});

describe("validateReport", () => {
  const T = "11111111-1111-4111-8111-111111111111";
  const ctx: ReportContext = {
    bestOf: 3,
    heroesByFaction: new Map([
      ["castle", new Set(["orrin", "valeska"])],
      ["necropolis", new Set(["sandro"])],
    ]),
    activeTemplateIds: new Set([T]),
  };
  const game = (winner: "A" | "B", over: Record<string, unknown> = {}) => ({
    winner,
    mapTemplateId: T,
    factionA: "castle",
    factionB: "necropolis",
    heroA: "orrin",
    heroB: "sandro",
    day: { month: 1, week: 4, day: 2 },
    ...over,
  });

  it("akceptuje 2:1 i liczy wynik", () => {
    const r = validateReport({ games: [game("A"), game("B"), game("A")] }, ctx);
    expect(r.ok && r.value).toMatchObject({ winner: "A", scoreA: 2, scoreB: 1 });
  });

  it("akceptuje 0:2", () => {
    const r = validateReport({ games: [game("B"), game("B")] }, ctx);
    expect(r.ok && r.value.winner).toBe("B");
  });

  it("odrzuca nadmiarowe gry po rozstrzygnięciu", () => {
    expect(validateReport({ games: [game("A"), game("A"), game("B")] }, ctx).ok).toBe(false);
  });

  it("odrzuca nierozstrzygniętą serię", () => {
    expect(validateReport({ games: [game("A"), game("B")] }, ctx).ok).toBe(false);
  });

  it("odrzuca bohatera spoza frakcji", () => {
    const r = validateReport({ games: [game("A", { heroA: "sandro" }), game("A")] }, ctx);
    expect(r.ok).toBe(false);
  });

  it("odrzuca nieprawidłowy dzień", () => {
    const r = validateReport({ games: [game("A", { day: { month: 1, week: 5, day: 1 } }), game("A")] }, ctx);
    expect(r.ok).toBe(false);
  });

  it("Bo5 wymaga 3 zwycięstw", () => {
    const bo5 = { ...ctx, bestOf: 5 };
    expect(validateReport({ games: [game("A"), game("A")] }, bo5).ok).toBe(false);
    expect(validateReport({ games: [game("A"), game("B"), game("A"), game("B"), game("A")] }, bo5).ok).toBe(true);
  });

  it("waliduje link VOD", () => {
    expect(validateReport({ games: [game("A"), game("A")], vodUrl: "https://evil.example/x" }, ctx).ok).toBe(false);
    expect(validateReport({ games: [game("A"), game("A")], vodUrl: "https://www.twitch.tv/videos/1" }, ctx).ok).toBe(true);
  });
});
