import Link from "next/link";
import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { StatusBadge } from "@/components/game/MatchRow";
import { LiveRefresh } from "@/components/LiveRefresh";
import { pageRequireRole } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { listMatchesForStaff, type ReportFilter } from "@/server/queries";
import { fmtDateTime } from "@/lib/labels";

const FILTERS: [ReportFilter, string][] = [
  ["disputed", "Spory"],
  ["reported", "Czekające na potwierdzenie"],
  ["open", "Wszystkie otwarte"],
  ["done", "Zakończone"],
  ["all", "Wszystkie"],
];

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  await connection();
  await pageRequireRole("MODERATOR");
  const sp = await searchParams;
  const filter = (FILTERS.find(([k]) => k === sp.f)?.[0] ?? "disputed") as ReportFilter;
  const t = await getTournament();
  const rows = await listMatchesForStaff(t.id, filter, sp.q?.trim() || undefined);

  return (
    <div className="space-y-6">
      <LiveRefresh topics={["matches"]} />
      <h1 className="title-gold text-3xl font-black">Raporty i spory</h1>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/admin/raporty?f=${k}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`} className={`btn btn-sm ${k === filter ? "btn-primary" : "btn-ghost"}`}>
            {label}
          </Link>
        ))}
        <form className="ml-auto flex gap-2">
          <input type="hidden" name="f" value={filter} />
          <input name="q" defaultValue={sp.q} placeholder="Nick gracza…" className="input py-1.5" />
          <button className="btn btn-sm">Szukaj</button>
        </form>
      </div>
      <Frame bodyClassName="p-0">
        {rows.length === 0 ? (
          <Empty>Brak meczów w tym widoku.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="table-h3 min-w-[720px]">
              <thead>
                <tr>
                  <th>Etap</th>
                  <th>Mecz</th>
                  <th className="num">Wynik</th>
                  <th>Status</th>
                  <th>Termin</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs text-cream-dim">{m.label}</td>
                    <td>
                      <span className="text-[#ffb0a8]">{m.a?.nick ?? "TBD"}</span> <span className="text-cream-dim">vs</span>{" "}
                      <span className="text-[#b5c8ff]">{m.b?.nick ?? "TBD"}</span>
                    </td>
                    <td className="num font-display font-bold">{m.status === "CONFIRMED" || m.status === "WALKOVER" ? `${m.scoreA}:${m.scoreB}` : "—"}</td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="text-xs">{m.scheduledAt ? fmtDateTime(m.scheduledAt) : "—"}</td>
                    <td>
                      <Link href={`/admin/raporty/${m.id}`} className="btn btn-sm">
                        Otwórz
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Frame>
    </div>
  );
}
