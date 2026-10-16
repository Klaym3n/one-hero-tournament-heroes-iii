import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { ContentEditor, GeneralConfigForm } from "@/components/admin/ConfigForm";
import { pageRequireRole } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";

export default async function AdminConfigPage() {
  await connection();
  await pageRequireRole("ADMIN");
  const t = await getTournament();
  return (
    <div className="space-y-6">
      <h1 className="title-gold text-3xl font-black">Konfiguracja i treści</h1>
      <Frame title="Ustawienia turnieju">
        <GeneralConfigForm
          initial={{
            name: t.name,
            tagline: t.tagline,
            bannerUrl: t.bannerUrl ?? "",
            currentRoundLabel: t.currentRoundLabel ?? "",
            gameSettings: t.gameSettings,
            groupBestOf: t.groupBestOf,
            knockoutBestOf: t.knockoutBestOf,
            finalBestOf: t.finalBestOf,
            thirdPlaceBestOf: t.thirdPlaceBestOf,
            minSlotMinutes: t.minSlotMinutes,
          }}
        />
      </Frame>
      <Frame title="Treści stron">
        <ContentEditor
          initial={{ infoMd: t.infoMd, formatMd: t.formatMd, prizesMd: t.prizesMd, scheduleMd: t.scheduleMd, rulesMd: t.rulesMd, privacyMd: t.privacyMd }}
        />
      </Frame>
    </div>
  );
}
