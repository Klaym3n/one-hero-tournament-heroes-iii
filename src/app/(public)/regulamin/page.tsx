import type { Metadata } from "next";
import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { Markdown } from "@/components/ui/Markdown";
import { getTournament } from "@/lib/tournament/current";

export const metadata: Metadata = { title: "Regulamin" };

export default async function RulesPage() {
  await connection();
  const t = await getTournament();
  return (
    <Frame className="mx-auto max-w-3xl" bodyClassName="p-5 sm:p-8">
      <Markdown>{t.rulesMd || "# Regulamin\n\nRegulamin zostanie opublikowany wkrótce."}</Markdown>
      <p className="mt-8 text-xs text-cream-dim">Wersja regulaminu: {t.rulesVersion}</p>
    </Frame>
  );
}
