import { z } from "zod";
import { isFactionSlug } from "@/data/factions";
import { isValidMWD } from "@/lib/mwd";

export const VOD_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "twitch.tv", "www.twitch.tv", "m.twitch.tv", "kick.com", "www.kick.com"];

export function isAllowedVodUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && VOD_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export const reportGameSchema = z.object({
  winner: z.enum(["A", "B"]),
  mapTemplateId: z.string().uuid(),
  factionA: z.string(),
  factionB: z.string(),
  heroA: z.string().min(1),
  heroB: z.string().min(1),
  day: z.object({ month: z.number().int(), week: z.number().int(), day: z.number().int() }),
  notes: z.string().trim().max(500).optional().default(""),
});

export const reportSchema = z.object({
  games: z.array(reportGameSchema).min(1).max(7),
  summary: z.string().trim().max(2000).optional().default(""),
  vodUrl: z.string().trim().max(500).optional().default(""),
});

export type ReportInput = z.input<typeof reportSchema>;
export type ReportGameInput = z.infer<typeof reportGameSchema>;

export type ReportContext = {
  bestOf: number;
  /** slug frakcji → zbiór slugów aktywnych bohaterów */
  heroesByFaction: Map<string, Set<string>>;
  activeTemplateIds: Set<string>;
};

export type ValidReport = {
  games: ReportGameInput[];
  winner: "A" | "B";
  scoreA: number;
  scoreB: number;
  summary: string | null;
  vodUrl: string | null;
};

export type ValidationResult = { ok: true; value: ValidReport } | { ok: false; errors: string[] };

/** Walidacja wyniku serii BoN i zawartości każdej gry. */
export function validateReport(raw: unknown, ctx: ReportContext): ValidationResult {
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: ["Nieprawidłowy format raportu."] };
  const { games, summary, vodUrl } = parsed.data;
  const errors: string[] = [];
  const need = Math.ceil(ctx.bestOf / 2);

  if (games.length < need || games.length > ctx.bestOf) {
    errors.push(`Seria Bo${ctx.bestOf} musi mieć od ${need} do ${ctx.bestOf} gier.`);
  }

  let a = 0;
  let b = 0;
  games.forEach((g, i) => {
    const n = i + 1;
    if (a >= need || b >= need) errors.push(`Gra ${n}: seria była już rozstrzygnięta.`);
    if (g.winner === "A") a++;
    else b++;
    if (!ctx.activeTemplateIds.has(g.mapTemplateId)) errors.push(`Gra ${n}: nieznany szablon mapy.`);
    for (const [side, faction, hero] of [
      ["A", g.factionA, g.heroA],
      ["B", g.factionB, g.heroB],
    ] as const) {
      const player = side === "A" ? "gracza 1" : "gracza 2";
      if (!isFactionSlug(faction)) {
        errors.push(`Gra ${n}: nieznana frakcja ${player}.`);
        continue;
      }
      if (!ctx.heroesByFaction.get(faction)?.has(hero)) {
        errors.push(`Gra ${n}: bohater ${player} nie należy do wybranej frakcji.`);
      }
    }
    if (!isValidMWD(g.day)) errors.push(`Gra ${n}: nieprawidłowy dzień (format M-T-D, np. 142).`);
  });

  if (a < need && b < need && games.length >= need) errors.push("Seria nie została rozstrzygnięta.");
  if (vodUrl && !isAllowedVodUrl(vodUrl)) errors.push("Link do nagrania musi prowadzić do YouTube, Twitch lub Kick (https).");

  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return {
    ok: true,
    value: {
      games,
      winner: a > b ? "A" : "B",
      scoreA: a,
      scoreB: b,
      summary: summary || null,
      vodUrl: vodUrl || null,
    },
  };
}
