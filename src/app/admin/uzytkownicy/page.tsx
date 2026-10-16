import Link from "next/link";
import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { Avatar } from "@/components/ui/Avatar";
import { UserRowControls } from "@/components/admin/UserControls";
import { pageRequireRole } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { listUsers } from "@/server/queries";
import { fmtDate, ROLE_LABELS } from "@/lib/labels";

const PSTATUS: Record<string, [string, string]> = {
  ACTIVE: ["Zapisany", "badge badge-green"],
  WITHDRAWN: ["Wycofany", "badge"],
  BANNED: ["Wykluczony", "badge badge-red"],
};

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await connection();
  const admin = await pageRequireRole("ADMIN");
  const { q } = await searchParams;
  const t = await getTournament();
  const rows = await listUsers(t.id, q?.trim() || undefined);

  return (
    <div className="space-y-6">
      <h1 className="title-gold text-3xl font-black">Użytkownicy</h1>
      <form className="flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Discord, nick lub Discord ID…" className="input" />
        <button className="btn">Szukaj</button>
      </form>
      <Frame bodyClassName="p-0">
        {rows.length === 0 ? (
          <Empty>Brak użytkowników.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="table-h3 min-w-[860px]">
              <thead>
                <tr>
                  <th>Konto</th>
                  <th>Turniej</th>
                  <th>Rola</th>
                  <th>Ostatnio</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className={u.banned ? "opacity-60" : undefined}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar src={u.avatarUrl} name={u.discordUsername} size={28} />
                        <div>
                          <p className="font-semibold">{u.discordGlobalName ?? u.discordUsername}</p>
                          <p className="text-xs text-cream-dim">
                            @{u.discordUsername} · {u.discordId}
                          </p>
                        </div>
                        {u.banned && <span className="badge badge-red">ban</span>}
                      </div>
                    </td>
                    <td>
                      {u.participantId ? (
                        <div className="space-y-0.5">
                          <Link href={`/gracze/${u.participantId}`} className="font-semibold hover:underline">
                            {u.nick}
                          </Link>
                          <span className={`ml-2 ${PSTATUS[u.participantStatus!]?.[1]}`}>{PSTATUS[u.participantStatus!]?.[0]}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-cream-dim">niezapisany</span>
                      )}
                    </td>
                    <td className="text-sm">{ROLE_LABELS[u.role]}</td>
                    <td className="text-xs text-cream-dim">{fmtDate(u.lastLoginAt ?? u.createdAt)}</td>
                    <td>
                      <UserRowControls
                        userId={u.id}
                        role={u.role}
                        banned={u.banned}
                        participantId={u.participantId}
                        participantStatus={u.participantStatus}
                        isSelf={u.id === admin.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Frame>
      <p className="text-xs text-cream-dim">Pierwsi administratorzy są nadawani automatycznie z ADMIN_DISCORD_IDS. Kolejne role nadawaj tutaj – nie edytuj bazy ręcznie.</p>
    </div>
  );
}
