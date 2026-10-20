import { FactionIcon } from "@/components/game/FactionIcon";
import { HeroPortrait } from "@/components/game/HeroPortrait";
import { FACTION_BY_SLUG, type FactionSlug } from "@/data/factions";
import { formatDay } from "@/lib/mwd";
import { fmtDateTime } from "@/lib/labels";
import type { AssetManifest } from "@/lib/assets";

export type ReportGameView = {
  gameNo: number;
  winnerId: string;
  templateName: string | null;
  factionA: string;
  factionB: string;
  heroA: string;
  heroB: string;
  endDay: number;
  notes: string | null;
};

export type ReportViewData = {
  id: string;
  status: string;
  byStaff: boolean;
  submittedBy: string;
  createdAt: Date;
  scoreA: number;
  scoreB: number;
  summary: string | null;
  vodUrl: string | null;
  games: ReportGameView[];
};

const REPORT_STATUS: Record<string, [string, string]> = {
  SUBMITTED: ["Oczekuje", "badge badge-blue"],
  ACCEPTED: ["Obowiązujący", "badge badge-green"],
  REJECTED: ["Odrzucony", "badge badge-red"],
  SUPERSEDED: ["Zastąpiony", "badge"],
};

function Side({ faction, hero, heroName, assets, winner, align }: { faction: string; hero: string; heroName: string; assets: AssetManifest; winner: boolean; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <FactionIcon slug={faction} hasImage={assets.factions.includes(`${faction}.png`)} size={28} />
      <HeroPortrait slug={hero} name={heroName} faction={faction} hasImage={assets.heroes.includes(`${hero}.png`)} size={30} />
      <div className="min-w-0">
        <p className={`truncate text-sm ${winner ? "font-bold text-gold-light" : ""}`}>{heroName}</p>
        <p className="truncate text-xs text-cream-dim">{FACTION_BY_SLUG[faction as FactionSlug]?.name ?? faction}</p>
      </div>
    </div>
  );
}

export function ReportView({
  report,
  playerAId,
  nickA,
  nickB,
  heroNames,
  assets,
}: {
  report: ReportViewData;
  playerAId: string | null;
  nickA: string;
  nickB: string;
  heroNames: Record<string, string>;
  assets: AssetManifest;
}) {
  const [label, cls] = REPORT_STATUS[report.status] ?? [report.status, "badge"];
  return (
    <article className="frame-xs bg-black/30">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/15 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cls}>{label}</span>
          {report.byStaff && <span className="badge badge-gold">Moderator</span>}
          <span className="font-display text-lg font-bold text-gold-light">
            {report.scoreA} : {report.scoreB}
          </span>
        </div>
        <span className="text-xs text-cream-dim">
          {report.submittedBy} · {fmtDateTime(report.createdAt)}
        </span>
      </header>
      <ol className="divide-y divide-gold/10">
        {report.games.map((g) => {
          const aWon = g.winnerId === playerAId;
          return (
            <li key={g.gameNo} className="px-3 py-2.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-cream-dim">
                <span className="font-display font-bold text-cream">Gra {g.gameNo}</span>
                <span>
                  {g.templateName ?? "—"} · koniec: dzień {formatDay(g.endDay)}
                </span>
                <span className="badge badge-gold">Wygrywa {aWon ? nickA : nickB}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Side faction={g.factionA} hero={g.heroA} heroName={heroNames[g.heroA] ?? g.heroA} assets={assets} winner={aWon} align="left" />
                <span className="font-display text-xs text-cream-dim">vs</span>
                <Side faction={g.factionB} hero={g.heroB} heroName={heroNames[g.heroB] ?? g.heroB} assets={assets} winner={!aWon} align="right" />
              </div>
              {g.notes && <p className="mt-2 text-sm text-cream-dim italic">„{g.notes}”</p>}
            </li>
          );
        })}
      </ol>
      {(report.summary || report.vodUrl) && (
        <footer className="space-y-2 border-t border-gold/15 px-3 py-2.5 text-sm">
          {report.summary && <p className="whitespace-pre-line">{report.summary}</p>}
          {report.vodUrl && (
            <a href={report.vodUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-sm">
              ▶ Nagranie
            </a>
          )}
        </footer>
      )}
    </article>
  );
}
