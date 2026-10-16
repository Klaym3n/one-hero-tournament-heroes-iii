import Link from "next/link";
import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { StatusBadge } from "@/components/game/MatchRow";
import { LiveRefresh } from "@/components/LiveRefresh";
import { pageRequireRole } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { scheduleList } from "@/server/queries";
import { fmtDateTime, fmtTime } from "@/lib/labels";

function dayKey(d: Date) {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long" }).format(d);
}

export default async function AdminSchedulePage() {
  await connection();
  await pageRequireRole("MODERATOR");
  const t = await getTournament();
  const rows = await scheduleList(t.id);
  const scheduled = rows.filter((r) => r.scheduledAt).sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime());
  const unscheduled = rows.filter((r) => !r.scheduledAt);
  const days = new Map<string, typeof scheduled>();
  for (const r of scheduled) days.set(dayKey(r.scheduledAt!), [...(days.get(dayKey(r.scheduledAt!)) ?? []), r]);

  return (
    <div className="space-y-6">
      <LiveRefresh topics={["matches"]} />
      <h1 className="title-gold text-3xl font-black">Harmonogram meczów</h1>
      <Frame title={`Zaplanowane (${scheduled.length})`}>
        {scheduled.length === 0 ? (
          <Empty>Brak zaplanowanych meczów.</Empty>
        ) : (
          <div className="space-y-5">
            {[...days.entries()].map(([day, list]) => (
              <section key={day}>
                <h3 className="mb-2 font-display font-bold text-gold-light capitalize">{day}</h3>
                <ul className="space-y-1.5">
                  {list.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-sm bg-black/20 px-3 py-2 text-sm">
                      <span className="w-14 font-display font-bold text-gold-light tabular-nums">{fmtTime(m.scheduledAt!)}</span>
                      <span className="flex-1">
                        {m.a?.nick} <span className="text-cream-dim">vs</span> {m.b?.nick}
                        <span className="ml-2 text-xs text-cream-dim">{m.label}</span>
                      </span>
                      <StatusBadge status={m.status} />
                      <Link href={`/admin/raporty/${m.id}`} className="btn btn-sm btn-ghost">
                        Edytuj
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Frame>
      <Frame title={`Bez terminu (${unscheduled.length})`}>
        {unscheduled.length === 0 ? (
          <Empty>Wszystkie otwarte mecze mają termin.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {unscheduled.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-sm bg-black/20 px-3 py-2 text-sm">
                <span className="flex-1">
                  {m.a?.nick} <span className="text-cream-dim">vs</span> {m.b?.nick}
                  <span className="ml-2 text-xs text-cream-dim">{m.label}</span>
                </span>
                {m.proposal ? (
                  <span className="badge badge-green">wspólny termin: {fmtDateTime(m.proposal.startsAt)}</span>
                ) : (
                  <span className="badge">brak wspólnej dostępności</span>
                )}
                <Link href={`/admin/raporty/${m.id}`} className="btn btn-sm btn-ghost">
                  Ustaw
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Frame>
    </div>
  );
}
