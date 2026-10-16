import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { AnnouncementEditor } from "@/components/admin/CrudForms";
import { pageRequireRole } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { fmtDateTime } from "@/lib/labels";

export default async function AdminAnnouncementsPage() {
  await connection();
  await pageRequireRole("ADMIN");
  const t = await getTournament();
  const rows = await db.select().from(announcements).where(eq(announcements.tournamentId, t.id)).orderBy(desc(announcements.createdAt));
  return (
    <div className="space-y-6">
      <h1 className="title-gold text-3xl font-black">Ogłoszenia</h1>
      <Frame title="Nowe ogłoszenie">
        <AnnouncementEditor initial={{ title: "", bodyMd: "", pinned: false, published: true }} />
      </Frame>
      {rows.map((a) => (
        <Frame key={a.id} title={a.title} actions={<span className="text-xs text-cream-dim">{fmtDateTime(a.createdAt)}</span>}>
          <AnnouncementEditor initial={{ id: a.id, title: a.title, bodyMd: a.bodyMd, pinned: a.pinned, published: a.published }} />
        </Frame>
      ))}
    </div>
  );
}
