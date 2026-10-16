import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { ProfileForm } from "@/components/account/ProfileForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { withdrawAction } from "@/server/actions";
import { pageRequireUser } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { getParticipantByUser } from "@/server/queries";

export const metadata: Metadata = { title: "Ustawienia profilu" };

export default async function SettingsPage() {
  await connection();
  const user = await pageRequireUser("/konto/ustawienia");
  const t = await getTournament();
  const me = await getParticipantByUser(t.id, user.id);

  if (!me) {
    return (
      <Frame className="mx-auto max-w-lg" title="Ustawienia profilu">
        <p className="mb-4">Profil gracza powstaje po zapisie do turnieju.</p>
        <Link href="/konto/zapis" className="btn btn-primary">
          Zapisz się
        </Link>
      </Frame>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Frame title="Ustawienia profilu">
        <ProfileForm
          canEditNick={t.phase === "REGISTRATION_OPEN" || t.phase === "DRAFT"}
          initial={{ nick: me.nick, youtubeUrl: me.youtubeUrl ?? "", twitchUrl: me.twitchUrl ?? "", kickUrl: me.kickUrl ?? "", bio: me.bio ?? "" }}
        />
      </Frame>
      {t.phase === "REGISTRATION_OPEN" && me.status === "ACTIVE" && (
        <Frame title="Rezygnacja">
          <p className="mb-3 text-sm text-cream-dim">Możesz wypisać się z turnieju do momentu zamknięcia zapisów.</p>
          <ActionButton action={withdrawAction} className="btn btn-primary btn-sm" confirm="Na pewno chcesz wypisać się z turnieju?">
            Wypisz mnie z turnieju
          </ActionButton>
        </Frame>
      )}
    </div>
  );
}
