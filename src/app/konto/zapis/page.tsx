import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { RegisterForm } from "@/components/account/RegisterForm";
import { pageRequireUser } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { getParticipantByUser } from "@/server/queries";

export const metadata: Metadata = { title: "Zapis do turnieju" };

export default async function RegisterPage() {
  await connection();
  const user = await pageRequireUser("/konto/zapis");
  const t = await getTournament();
  const me = await getParticipantByUser(t.id, user.id);
  if (me?.status === "ACTIVE") redirect("/konto");

  return (
    <Frame className="mx-auto max-w-lg" title="Zapis do turnieju" bodyClassName="p-5 sm:p-7">
      {t.phase !== "REGISTRATION_OPEN" ? (
        <p className="text-center text-cream-dim">Zapisy są obecnie zamknięte.</p>
      ) : me?.status === "BANNED" ? (
        <p className="text-center">Twoje konto zostało wykluczone z turnieju.</p>
      ) : (
        <RegisterForm defaultNick={me?.nick ?? user.discordGlobalName ?? user.discordUsername} />
      )}
    </Frame>
  );
}
