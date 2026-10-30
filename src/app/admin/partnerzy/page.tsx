import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { PartnerRow } from "@/components/admin/CrudForms";
import { pageRequireRole } from "@/lib/authz";
import { getPartners, getTournament } from "@/lib/tournament/current";

export default async function AdminPartnersPage() {
  await connection();
  await pageRequireRole("ADMIN");
  const t = await getTournament();
  const rows = await getPartners(t.id, false);
  return (
    <div className="space-y-6">
      <h1 className="title-gold text-3xl font-black">Partnerzy turnieju</h1>
      <Frame title="Lista partnerów">
        <p className="mb-4 text-sm text-cream-dim">
          Widoczni partnerzy pojawiają się na dole strony głównej (w podanej kolejności). Dopóki nie ma żadnego, strona pokazuje miejsca
          zastępcze „Miejsce dla partnera”. Logo wgraj do katalogu <code>assets/partners/</code> (lokalnie: <code>public/assets/partners/</code>) i wpisz
          adres <code>/grafika/partners/nazwa.png</code> – najlepiej PNG/SVG z przezroczystym tłem, w jasnych kolorach.
        </p>
        <div className="space-y-3">
          {rows.length === 0 && <p className="text-sm text-cream-dim italic">Brak partnerów.</p>}
          {rows.map((p) => (
            <PartnerRow
              key={p.id}
              initial={{ id: p.id, name: p.name, tier: p.tier, url: p.url ?? "", logoUrl: p.logoUrl ?? "", active: p.active, sortOrder: p.sortOrder }}
            />
          ))}
        </div>
      </Frame>
      <Frame title="Nowy partner">
        <PartnerRow initial={{ name: "", tier: "", url: "", logoUrl: "", active: true, sortOrder: rows.length }} />
      </Frame>
    </div>
  );
}
