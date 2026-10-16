"use client";

import { useState } from "react";
import { updateProfileAction } from "@/server/actions";
import { useAction } from "@/components/ui/useAction";
import { FeedbackBox } from "@/components/ui/FeedbackBox";
import { StreamIcon } from "@/components/ui/icons";

type Values = { nick: string; youtubeUrl: string; twitchUrl: string; kickUrl: string; bio: string };

export function ProfileForm({ initial, canEditNick }: { initial: Values; canEditNick: boolean }) {
  const [v, setV] = useState(initial);
  const { pending, feedback, exec } = useAction();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => updateProfileAction(canEditNick ? v : { ...v, nick: undefined }));
      }}
    >
      <div>
        <label className="label" htmlFor="nick">
          Nick w grze
        </label>
        <input id="nick" className="input" value={v.nick} onChange={set("nick")} disabled={!canEditNick} maxLength={24} />
        {!canEditNick && <p className="mt-1 text-xs text-cream-dim">Nick można zmienić tylko w trakcie zapisów – w razie potrzeby napisz do organizatora.</p>}
      </div>
      {(
        [
          ["youtubeUrl", "youtube", "YouTube", "https://www.youtube.com/@twojkanal"],
          ["twitchUrl", "twitch", "Twitch", "https://www.twitch.tv/twojkanal"],
          ["kickUrl", "kick", "Kick", "https://kick.com/twojkanal"],
        ] as const
      ).map(([key, icon, label, ph]) => (
        <div key={key}>
          <label className="label flex items-center gap-2" htmlFor={key}>
            <StreamIcon kind={icon} /> {label}
          </label>
          <input id={key} className="input" type="url" inputMode="url" value={v[key]} onChange={set(key)} placeholder={ph} />
        </div>
      ))}
      <div>
        <label className="label" htmlFor="bio">
          Kilka słów o sobie (opcjonalnie)
        </label>
        <textarea id="bio" className="textarea" rows={3} maxLength={300} value={v.bio} onChange={set("bio")} placeholder="Ulubiona frakcja, doświadczenie, godziny gry…" />
      </div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Zapisywanie…" : "Zapisz zmiany"}
      </button>
      <FeedbackBox feedback={feedback} />
    </form>
  );
}
