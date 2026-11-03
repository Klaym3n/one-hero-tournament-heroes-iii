import type { Metadata } from "next";
import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { ProfileForm } from "@/components/account/ProfileForm";
import { ActionButton } from "@/components/ui/ActionButton";
import { withdrawAction } from "@/server/actions";
import { pageRequireUser } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { getParticipantByUser, getUserProfile } from "@/server/queries";

export const metadata: Metadata = { title: "Ustawienia profilu" };

export default async function SettingsPage() {
  await connection();
  const user = await pageRequireUser("/konto/ustawienia");
  const t = await getTournament();
  const [me, profile] = await Promise.all([getParticipantByUser(t.id, user.id), getUserProfile(user.id)]);
  // zgłoszenie turniejowe ma pierwszeństwo – to jego dane widać publicznie
  const src = me ?? profile;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Frame title="Ustawienia profilu">
        {!me && (
          <p className="mb-4 text-sm text-cream-dim">
            Nie jesteś zapisany(-a) do turnieju – uzupełnione dane zostaną użyte przy zapisie i pokażą się na Twoim profilu gracza.
          </p>
        )}
        <ProfileForm
          canEditNick={!me || t.phase === "REGISTRATION_OPEN" || t.phase === "DRAFT"}
          initial={{ nick: src?.nick ?? "", youtubeUrl: src?.youtubeUrl ?? "", twitchUrl: src?.twitchUrl ?? "", kickUrl: src?.kickUrl ?? "", bio: src?.bio ?? "" }}
        />
      </Frame>
      {t.phase === "REGISTRATION_OPEN" && me?.status === "ACTIVE" && (
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
