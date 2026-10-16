import Link from "next/link";
import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { LiveRefresh } from "@/components/LiveRefresh";
import { pageRequireRole, hasRole } from "@/lib/authz";
import { getTournament } from "@/lib/tournament/current";
import { adminDashboard } from "@/server/queries";
import { env } from "@/lib/env";
import { PHASE_LABELS } from "@/lib/labels";

export default async function AdminHome() {
  await connection();
  const user = await pageRequireRole("MODERATOR");
  const t = await getTournament();
  const c = await adminDashboard(t.id);
  const e = env();
  const checks = [
    ["Logowanie Discord (OAuth)", Boolean(e.DISCORD_CLIENT_ID && e.DISCORD_CLIENT_SECRET)],
    ["Bot Discord + serwer", e.discordBotConfigured],
    ["Kanał ogłoszeń", Boolean(e.DISCORD_CHANNEL_ID)],
    ["Zaproszenie na serwer", Boolean(e.DISCORD_INVITE_URL)],
    ["Pierwszy administrator", e.adminDiscordIds.length > 0],
  ] as const;

  const tiles = [
    ["Faza", PHASE_LABELS[t.phase], "/admin/turniej"],
    ["Gracze", c.players, "/admin/uzytkownicy"],
    ["Spory", c.disputed, "/admin/raporty?f=disputed"],
    ["Czeka na potw.", c.reported, "/admin/raporty?f=reported"],
    ["Do rozegrania", c.open, "/admin/raporty?f=open"],
    ["Rozegrane", `${c.done}/${c.total}`, "/admin/raporty?f=done"],
  ] as const;

  return (
    <div className="space-y-6">
      <LiveRefresh topics={["matches", "players", "groups", "bracket"]} />
      <h1 className="title-gold text-3xl font-black">Pulpit</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([k, v, href]) => (
          <Link key={k} href={href} className="stone rounded-sm border border-black p-4 shadow-[0_0_0_1px_var(--gold-dark)] hover:shadow-[0_0_0_1px_var(--gold-light)]">
            <p className="text-[11px] tracking-widest text-cream-dim uppercase">{k}</p>
            <p className={`font-display text-2xl font-bold ${k === "Spory" && Number(v) > 0 ? "text-crimson-light" : "text-gold-light"}`}>{v}</p>
          </Link>
        ))}
      </div>
      {c.disputed > 0 && (
        <Frame title="Wymaga uwagi">
          <p>
            Otwarte spory: <strong>{c.disputed}</strong>.{" "}
            <Link href="/admin/raporty?f=disputed" className="text-gold-light underline">
              Przejdź do kolejki
            </Link>
          </p>
        </Frame>
      )}
      {hasRole(user, "ADMIN") && (
        <Frame title="Konfiguracja środowiska">
          <ul className="grid gap-2 sm:grid-cols-2">
            {checks.map(([label, ok]) => (
              <li key={label} className="flex items-center gap-2 text-sm">
                <span className={ok ? "text-emerald-light" : "text-crimson-light"}>{ok ? "✔" : "✖"}</span> {label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-cream-dim">
            Discord – kolejka: {c.outboxPending} oczekujących, {c.outboxFailed} nieudanych (7 dni).{" "}
            <Link href="/admin/discord" className="underline">
              Szczegóły
            </Link>
          </p>
        </Frame>
      )}
    </div>
  );
}
