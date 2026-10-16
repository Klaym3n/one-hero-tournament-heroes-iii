"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerAction } from "@/server/actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";
import { DiscordIcon } from "@/components/ui/icons";

export function RegisterForm({ defaultNick }: { defaultNick: string }) {
  const router = useRouter();
  const [nick, setNick] = useState(defaultNick.slice(0, 24));
  const [rules, setRules] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [invite, setInvite] = useState<string | null | undefined>(undefined);
  const { pending, feedback, exec } = useAction();

  const submit = () =>
    exec(() => registerAction({ nick, acceptRules: rules, acceptPrivacy: privacy }), {
      onOk: (res) => {
        if (res?.status === "needs_discord") setInvite(res.inviteUrl);
        else router.push("/konto");
      },
    });

  if (invite !== undefined) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-display text-lg text-gold-light">Jeszcze jeden krok!</p>
        <p>Aby wziąć udział w turnieju, musisz dołączyć do naszego serwera Discord. Nie udało się dodać Cię automatycznie.</p>
        {invite ? (
          <a href={invite} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <DiscordIcon /> Dołącz do serwera
          </a>
        ) : (
          <p className="text-sm text-cream-dim">Poproś organizatora o zaproszenie.</p>
        )}
        <p className="text-sm text-cream-dim">Po dołączeniu wróć tutaj i kliknij poniżej.</p>
        <button className="btn" disabled={pending} onClick={submit}>
          Dołączyłem(-am) – dokończ zapis
        </button>
        <FeedbackBox feedback={feedback} />
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <label className="label" htmlFor="nick">
          Nick w grze
        </label>
        <input id="nick" className="input" value={nick} onChange={(e) => setNick(e.target.value)} minLength={2} maxLength={24} required autoComplete="nickname" />
        <p className="mt-1 text-xs text-cream-dim">Nick, pod którym grasz w lobby HotA (2–24 znaki).</p>
      </div>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--gold)]" checked={rules} onChange={(e) => setRules(e.target.checked)} />
        <span className="text-sm">
          Akceptuję{" "}
          <Link href="/regulamin" target="_blank" className="text-gold-light underline">
            regulamin turnieju
          </Link>
          .
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--gold)]" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
        <span className="text-sm">
          Akceptuję{" "}
          <Link href="/polityka-prywatnosci" target="_blank" className="text-gold-light underline">
            politykę prywatności
          </Link>{" "}
          i zgadzam się na publiczne wyświetlanie mojego nicku, awatara i wyników.
        </span>
      </label>
      <p className="text-xs text-cream-dim">Przy zapisie sprawdzimy, czy jesteś na serwerze Discord turnieju – jeśli nie, spróbujemy dodać Cię automatycznie.</p>
      <button className="btn btn-primary w-full" disabled={pending || !rules || !privacy || nick.trim().length < 2}>
        {pending ? "Zapisywanie…" : "Zapisz mnie do turnieju"}
      </button>
      <FeedbackBox feedback={feedback} />
    </form>
  );
}
