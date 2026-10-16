import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/authz";
import { unreadCount } from "@/server/queries";
import { Avatar } from "@/components/ui/Avatar";

export async function UserMenu() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <Link href="/logowanie" className="btn btn-sm">
        Zaloguj
      </Link>
    );
  }
  const unread = await unreadCount(user.id);
  const name = user.discordGlobalName ?? user.discordUsername;
  return (
    <div className="flex items-center gap-2">
      {hasRole(user, "MODERATOR") && (
        <Link href="/admin" className="btn btn-sm btn-ghost hidden sm:inline-flex">
          Panel
        </Link>
      )}
      <Link href="/konto" className="flex items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-white/5" title="Moje konto">
        <span className="relative">
          <Avatar src={user.avatarUrl} name={name} size={30} />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 rounded-full border border-black bg-crimson-light px-1 text-center text-[10px] leading-4 font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-semibold lg:inline">{name}</span>
      </Link>
    </div>
  );
}
