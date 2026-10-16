import { connection } from "next/server";
import { Frame, Empty } from "@/components/ui/Frame";
import { pageRequireRole } from "@/lib/authz";
import { auditLog } from "@/server/queries";
import { ACTION_LABELS } from "@/lib/audit";
import { fmtDateTime } from "@/lib/labels";

export default async function AdminLogPage() {
  await connection();
  await pageRequireRole("MODERATOR");
  const rows = await auditLog(300);
  return (
    <div className="space-y-6">
      <h1 className="title-gold text-3xl font-black">Log akcji administracyjnych</h1>
      <Frame bodyClassName="p-0">
        {rows.length === 0 ? (
          <Empty>Brak wpisów.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="table-h3 min-w-[720px]">
              <thead>
                <tr>
                  <th>Kiedy</th>
                  <th>Kto</th>
                  <th>Akcja</th>
                  <th>Szczegóły</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ l, actor }) => (
                  <tr key={l.id}>
                    <td className="text-xs whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                    <td className="text-sm">{actor ?? "system"}</td>
                    <td className="text-sm font-semibold">{ACTION_LABELS[l.action] ?? l.action}</td>
                    <td className="text-xs text-cream-dim">
                      {l.payload ? (
                        <details>
                          <summary className="cursor-pointer">
                            {l.entityType} {l.entityId?.slice(0, 8)}
                          </summary>
                          <pre className="mt-1 max-w-xl overflow-x-auto rounded-sm bg-black/40 p-2">{JSON.stringify(l.payload, null, 2)}</pre>
                        </details>
                      ) : (
                        `${l.entityType ?? ""} ${l.entityId?.slice(0, 8) ?? ""}`
                      )}
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
