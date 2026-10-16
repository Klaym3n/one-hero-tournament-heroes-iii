import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Frame, Empty, PageTitle } from "@/components/ui/Frame";
import { Avatar } from "@/components/ui/Avatar";
import { StreamIcon } from "@/components/ui/icons";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getTournament } from "@/lib/tournament/current";
import { listPlayers } from "@/server/queries";

export const metadata: Metadata = { title: "Gracze" };

export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await connection();
  const { q } = await searchParams;
  const t = await getTournament();
  const players = await listPlayers(t.id, q?.trim() || undefined);
  return (
    <div>
      <LiveRefresh topics={["players"]} />
      <PageTitle subtitle={`Zapisanych graczy: ${players.filter((p) => p.status === "ACTIVE").length}`}>Gracze</PageTitle>
      <form className="mx-auto mb-6 flex max-w-md gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Szukaj gracza…" className="input" aria-label="Szukaj gracza" />
        <button className="btn">Szukaj</button>
      </form>
      <Frame bodyClassName="p-2 sm:p-3">
        {players.length === 0 ? (
          <Empty>{q ? "Brak graczy pasujących do wyszukiwania." : "Nikt jeszcze się nie zapisał."}</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/gracze/${p.id}`}
                  className={`flex items-center gap-3 rounded-sm border border-black/60 bg-black/20 px-3 py-2 shadow-[0_0_0_1px_rgba(212,175,55,0.12)] hover:shadow-[0_0_0_1px_var(--gold)] ${p.status !== "ACTIVE" ? "opacity-50" : ""}`}
                >
                  <Avatar src={p.avatarUrl} name={p.nick} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.nick}</span>
                    <span className="text-xs text-cream-dim">
                      {p.groupName ? `Grupa ${p.groupName} · ` : ""}
                      {p.wins}W / {p.losses}P{p.status === "BANNED" ? " · wykluczony" : ""}
                    </span>
                  </span>
                  <span className="flex gap-1.5 text-cream-dim">
                    {p.youtubeUrl && <StreamIcon kind="youtube" />}
                    {p.twitchUrl && <StreamIcon kind="twitch" />}
                    {p.kickUrl && <StreamIcon kind="kick" />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Frame>
    </div>
  );
}
