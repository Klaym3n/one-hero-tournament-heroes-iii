import { connection } from "next/server";
import { Empty, Frame } from "@/components/ui/Frame";
import { pageRequireRole } from "@/lib/authz";
import { siteStats } from "@/server/queries";

const DAYS = 30;

function lastDays(n: number): string[] {
  const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" });
  return Array.from({ length: n }, (_, i) => fmt.format(new Date(Date.now() - (n - 1 - i) * 86_400_000)));
}

const short = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

export default async function AdminStatsPage() {
  await connection();
  await pageRequireRole("ADMIN");
  const s = await siteStats(DAYS);
  const byDay = new Map(s.daily.map((d) => [d.day, d]));
  const series = lastDays(DAYS).map((day) => ({ day, views: byDay.get(day)?.views ?? 0, visitors: byDay.get(day)?.visitors ?? 0 }));
  const max = Math.max(1, ...series.map((d) => d.views));
  const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");

  const tiles = [
    ["Wyświetlenia dziś", s.totals.today],
    ["Odwiedzający dziś", s.totals.todayVisitors],
    ["Wyświetlenia 7 dni", s.totals.week],
    ["Wyświetlenia 30 dni", s.totals.month],
    ["Wizyty dzienne (30 dni)", s.visitorDays],
    ["Zalogowani (30 dni)", s.totals.loggedIn],
    ["Z telefonu (30 dni)", pct(s.totals.mobile, s.totals.month)],
    ["Wyświetlenia łącznie", s.totals.all],
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="title-gold text-3xl font-black">Statystyki odwiedzin</h1>
      <p className="text-sm text-cream-dim">
        Dane widoczne tylko dla administratorów. Liczone bez ciasteczek: odwiedzający to dzienny, anonimowy skrót adresu IP i przeglądarki – ta sama osoba
        w kolejnym dniu liczy się ponownie. Boty i panel administracyjny nie są liczone.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="stone frame-sm p-4 max-sm:p-3">
            <p className="text-[11px] tracking-widest text-cream-dim uppercase">{k}</p>
            <p className="font-display text-2xl font-bold text-gold-light tabular-nums max-sm:text-xl">{v}</p>
          </div>
        ))}
      </div>

      <Frame title={`Wyświetlenia stron – ostatnie ${DAYS} dni`}>
        {s.totals.month === 0 ? (
          <Empty>Brak zarejestrowanych odwiedzin.</Empty>
        ) : (
          <>
            <div className="relative flex h-44 items-end gap-[2px] border-b border-gold-dark/60" role="img" aria-label={`Wykres wyświetleń dziennie, maksimum ${max}`}>
              <span className="absolute -top-1 left-0 text-[10px] text-cream-dim tabular-nums">{max}</span>
              {series.map((d) => (
                <div key={d.day} className="group relative flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[4px] bg-gold/80 group-hover:bg-gold-light"
                    style={{ height: `${(d.views / max) * 100}%`, minHeight: d.views ? 2 : 0 }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-sm border border-gold-dark bg-[#1a120a] px-2 py-1 text-[11px] whitespace-nowrap group-hover:block">
                    <strong className="text-gold-light">{short(d.day)}</strong> · {d.views} wyśw. · {d.visitors} odw.
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-cream-dim tabular-nums">
              <span>{short(series[0].day)}</span>
              <span>{short(series[Math.floor(DAYS / 2)].day)}</span>
              <span>{short(series[DAYS - 1].day)}</span>
            </div>
            <details className="mt-3 text-sm max-sm:overflow-x-auto">
              <summary className="cursor-pointer text-cream-dim">Tabela dzienna</summary>
              <table className="table-h3 mt-2 max-sm:text-xs">
                <thead>
                  <tr>
                    <th>Dzień</th>
                    <th className="text-right">Wyświetlenia</th>
                    <th className="text-right">Odwiedzający</th>
                  </tr>
                </thead>
                <tbody>
                  {[...series].reverse().map((d) => (
                    <tr key={d.day}>
                      <td>{d.day}</td>
                      <td className="text-right tabular-nums">{d.views}</td>
                      <td className="text-right tabular-nums">{d.visitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </Frame>

      <div className="grid gap-6 max-sm:grid-cols-1 lg:grid-cols-2">
        <Frame title="Najczęściej odwiedzane strony" bodyClassName="p-0">
          {s.pages.length === 0 ? (
            <Empty>Brak danych.</Empty>
          ) : (
            <table className="table-h3">
              <thead>
                <tr>
                  <th>Strona</th>
                  <th className="text-right">Wyśw.</th>
                  <th className="text-right">Odw.</th>
                </tr>
              </thead>
              <tbody>
                {s.pages.map((p) => (
                  <tr key={p.path}>
                    <td className="max-w-64 truncate font-mono text-xs max-sm:max-w-[45vw]">{p.path}</td>
                    <td className="text-right tabular-nums">{p.views}</td>
                    <td className="text-right tabular-nums">{p.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Frame>
        <Frame title="Skąd przychodzą odwiedzający" bodyClassName="p-0">
          {s.referrers.length === 0 ? (
            <Empty>Brak wejść z innych stron.</Empty>
          ) : (
            <table className="table-h3">
              <thead>
                <tr>
                  <th>Źródło</th>
                  <th className="text-right">Wejścia</th>
                </tr>
              </thead>
              <tbody>
                {s.referrers.map((r) => (
                  <tr key={r.referrer}>
                    <td className="text-sm max-sm:break-all">{r.referrer}</td>
                    <td className="text-right tabular-nums">{r.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Frame>
      </div>
    </div>
  );
}
