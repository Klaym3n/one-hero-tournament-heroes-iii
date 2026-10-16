import Link from "next/link";
import { Frame, Empty } from "@/components/ui/Frame";
import { ActionButton } from "@/components/ui/ActionButton";
import { markNotificationsReadAction } from "@/server/actions";
import { fmtDateTime } from "@/lib/labels";

type Note = { id: string; title: string; body: string; href: string | null; readAt: Date | null; createdAt: Date };

export function NotificationsList({ notes }: { notes: Note[] }) {
  const unread = notes.filter((n) => !n.readAt).length;
  return (
    <Frame
      title={`Powiadomienia${unread ? ` (${unread})` : ""}`}
      actions={unread > 0 ? <ActionButton action={markNotificationsReadAction} className="btn btn-sm btn-ghost">Oznacz jako przeczytane</ActionButton> : null}
    >
      {notes.length === 0 ? (
        <Empty>Brak powiadomień.</Empty>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const body = (
              <>
                <p className={`text-sm font-semibold ${n.readAt ? "text-cream-dim" : "text-gold-light"}`}>
                  {!n.readAt && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-crimson-light align-middle" aria-label="nowe" />}
                  {n.title}
                </p>
                {n.body && <p className="text-xs text-cream-dim">{n.body}</p>}
                <p className="mt-0.5 text-[10px] text-cream-dim/70">{fmtDateTime(n.createdAt)}</p>
              </>
            );
            return (
              <li key={n.id} className="rounded-sm bg-black/20 px-3 py-2">
                {n.href ? (
                  <Link href={n.href} className="block hover:opacity-90">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Frame>
  );
}
