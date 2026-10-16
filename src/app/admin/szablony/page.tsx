import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { TemplateRow } from "@/components/admin/CrudForms";
import { pageRequireRole } from "@/lib/authz";
import { getTemplates, getTournament } from "@/lib/tournament/current";

export default async function AdminTemplatesPage() {
  await connection();
  await pageRequireRole("ADMIN");
  const t = await getTournament();
  const templates = await getTemplates(t.id, false);
  return (
    <div className="space-y-6">
      <h1 className="title-gold text-3xl font-black">Szablony map</h1>
      <Frame title="Lista szablonów">
        <p className="mb-4 text-sm text-cream-dim">Aktywne szablony są do wyboru w raporcie meczowym i widoczne na stronie „Turniej”.</p>
        <div className="space-y-3">
          {templates.map((m) => (
            <TemplateRow key={m.id} initial={{ id: m.id, name: m.name, description: m.description, active: m.active, sortOrder: m.sortOrder }} />
          ))}
        </div>
      </Frame>
      <Frame title="Nowy szablon">
        <TemplateRow initial={{ name: "", description: "", active: true, sortOrder: templates.length }} />
      </Frame>
    </div>
  );
}
