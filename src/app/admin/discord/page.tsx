import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { PingRound, RetryButton } from "@/components/admin/DiscordControls";
import { pageRequireRole } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { adminDashboard, outboxRecent } from "@/server/queries";
import { env } from "@/lib/env";
import { fmtDateTime, PHASE_LABELS } from "@/lib/labels";

export default async function AdminDiscordPage() {
  await connection();
  await pageRequireRole("ADMIN");
  const t = await getTournament();
  const [c, outbox] = await Promise.all([adminDashboard(t.id), outboxRecent(60)]);
  const e = env();

  return (
    <div className="space-y-6">
      <h1 className="title-gold text-3xl font-black">Discord</h1>
      <Frame title="Powiadomienie o rundzie">
        <p className="mb-4 text-sm text-cream-dim">
          Jednym kliknięciem wyślesz na kanał turniejowy wiadomość z oznaczeniem (@) wszystkich graczy, którzy mają mecz do rozegrania, wraz z linkami do meczów.
        </p>
        {!e.DISCORD_CHANNEL_ID && <p className="mb-3 text-sm text-crimson-light">Brak DISCORD_CHANNEL_ID – ustaw zmienną środowiskową.</p>}
        <PingRound defaultLabel={t.currentRoundLabel ?? PHASE_LABELS[t.phase]} openMatches={c.open} disabled={!e.DISCORD_CHANNEL_ID || !e.DISCORD_BOT_TOKEN} />
      </Frame>
      <Frame title={`Kolejka wiadomości (oczekuje: ${c.outboxPending}, błędy 7 dni: ${c.outboxFailed})`}>
        {outbox.length === 0 ? (
          <Empty>Brak wiadomości.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="table-h3 min-w-[720px]">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Typ</th>
                  <th>Treść</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {outbox.map((o) => (
                  <tr key={o.id}>
                    <td className="text-xs whitespace-nowrap">{fmtDateTime(o.createdAt)}</td>
                    <td className="text-xs">{o.kind === "DM" ? "DM" : "Kanał"}</td>
                    <td className="max-w-md truncate text-xs" title={o.content}>
                      {o.content}
                    </td>
                    <td className="text-xs">
                      {o.sentAt ? (
                        <span className="badge badge-green">wysłano</span>
                      ) : o.failedAt ? (
                        <span className="badge badge-red" title={o.lastError ?? ""}>
                          błąd
                        </span>
                      ) : (
                        <span className="badge" title={o.lastError ?? ""}>
                          oczekuje{o.attempts ? ` (${o.attempts})` : ""}
                        </span>
                      )}
                    </td>
                    <td>{o.failedAt && <RetryButton id={o.id} />}</td>
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
