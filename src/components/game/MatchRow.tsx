import Link from "next/link";
import type { MatchView } from "@/server/queries";
import { MATCH_STATUS_LABELS, fmtDateTime } from "@/lib/labels";
import { Avatar } from "@/components/ui/Avatar";
import { getAssetManifest } from "@/lib/assets";
import { GameFlags } from "./PlayerFlag";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "badge",
  WAITING: "badge",
  REPORTED: "badge badge-blue",
  DISPUTED: "badge badge-red",
  CONFIRMED: "badge badge-green",
  WALKOVER: "badge badge-green",
};

export function StatusBadge({ status }: { status: MatchView["status"] }) {
  return <span className={STATUS_BADGE[status]}>{MATCH_STATUS_LABELS[status]}</span>;
}

function Side({ p, winner, align, colors, flags }: { p: MatchView["a"]; winner: boolean; align: "left" | "right"; colors: string[] | null; flags: string[] }) {
  if (!p) return <span className={`flex-1 truncate text-cream-dim italic ${align === "right" ? "text-right" : ""}`}>TBD</span>;
  return (
    <span className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <Avatar src={p.avatarUrl} name={p.nick} size={24} />
      <span className={`truncate ${winner ? "font-bold text-gold-light" : ""} ${p.status !== "ACTIVE" ? "line-through opacity-60" : ""}`}>{p.nick}</span>
      <GameFlags colors={colors} flags={flags} />
    </span>
  );
}

/** Wiersz meczu: gracze (z małymi flagami kolorów z kolejnych gier – po wprowadzeniu wyniku), wynik, status i termin. */
export async function MatchRow({ m, showLabel = true, perspective }: { m: MatchView; showLabel?: boolean; perspective?: string }) {
  const done = m.status === "CONFIRMED" || m.status === "WALKOVER";
  const { flags } = await getAssetManifest();
  const resultClass =
    perspective && done && m.winnerId ? (m.winnerId === perspective ? "text-emerald-light" : "text-crimson-light") : "text-gold-light";
  return (
    <Link
      href={`/mecze/${m.id}`}
      className="group frame-xs block bg-black/30 px-3 py-2.5 hover:brightness-125"
    >
      <div className="flex items-center gap-2 text-sm">
        <Side p={m.a} winner={done && m.winnerId === m.playerAId} align="left" colors={done ? m.colorsA : null} flags={flags} />
        <span className={`shrink-0 px-2 font-display text-base font-bold tabular-nums ${resultClass}`}>
          {done ? (m.status === "WALKOVER" && !m.winnerId ? "—" : `${m.scoreA} : ${m.scoreB}`) : "vs"}
        </span>
        <Side p={m.b} winner={done && m.winnerId === m.playerBId} align="right" colors={done ? m.colorsB : null} flags={flags} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-cream-dim">
        <span>
          {showLabel && m.label} {m.bestOf ? <span className="opacity-70">· Bo{m.bestOf}</span> : null}
        </span>
        <span className="flex items-center gap-2">
          {m.scheduledAt && !done && <span>📅 {fmtDateTime(m.scheduledAt)}</span>}
          {done && m.completedAt && <span>{fmtDateTime(m.completedAt)}</span>}
          <StatusBadge status={m.status} />
        </span>
      </div>
    </Link>
  );
}
