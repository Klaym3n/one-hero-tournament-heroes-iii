import type { Metadata } from "next";
import { connection } from "next/server";
import { Empty, Frame } from "@/components/ui/Frame";
import { Markdown } from "@/components/ui/Markdown";
import { getTournament } from "@/lib/tournament/current";
import { fmtDate } from "@/lib/labels";

export const metadata: Metadata = { title: "Regulamin" };

export default async function RulesPage() {
  await connection();
  const t = await getTournament();
  // przed otwarciem zapisów regulamin może jeszcze się zmieniać – nie publikujemy go
  if (t.phase === "DRAFT") {
    return (
      <Frame className="mx-auto max-w-3xl" title="Regulamin" bodyClassName="p-5 sm:p-8">
        <Empty>Regulamin zostanie udostępniony po uruchomieniu zapisów.</Empty>
      </Frame>
    );
  }
  return (
    <Frame className="mx-auto max-w-3xl" bodyClassName="p-5 sm:p-8">
      <Markdown>{t.rulesMd || "# Regulamin\n\nRegulamin zostanie opublikowany wkrótce."}</Markdown>
      <p className="mt-8 text-xs text-cream-dim">
        Wersja regulaminu: {t.rulesVersionLabel || t.rulesVersion}
        {t.rulesUpdatedAt && <> · Ostatnia aktualizacja: {fmtDate(t.rulesUpdatedAt)}</>}
      </p>
    </Frame>
  );
}
