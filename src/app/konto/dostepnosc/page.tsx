import type { Metadata } from "next";
import { connection } from "next/server";
import { Frame } from "@/components/ui/Frame";
import { AvailabilityCalendar } from "@/components/account/AvailabilityCalendar";
import { pageRequireUser } from "@/lib/authz";
import { getAvailability } from "@/server/scheduling";
import { addDaysWarsaw, weekStartWarsaw } from "@/lib/time";

export const metadata: Metadata = { title: "Moja dostępność" };

const MAX_WEEKS_AHEAD = 7;

function isoDay(d: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(d);
}

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  await connection();
  const user = await pageRequireUser("/konto/dostepnosc");
  const { w } = await searchParams;
  const current = weekStartWarsaw(Date.now());
  let week = current;
  if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) {
    const requested = weekStartWarsaw(new Date(`${w}T12:00:00Z`));
    const diffWeeks = Math.round((requested.getTime() - current.getTime()) / (7 * 86_400_000));
    if (diffWeeks >= 0 && diffWeeks <= MAX_WEEKS_AHEAD) week = requested;
  }
  const end = addDaysWarsaw(week, 7);
  const prevStart = addDaysWarsaw(week, -7);
  const [intervals, previous] = await Promise.all([getAvailability(user.id, week, end), getAvailability(user.id, prevStart, week)]);
  const weeksAhead = Math.round((week.getTime() - current.getTime()) / (7 * 86_400_000));

  return (
    <Frame title="Moja dostępność" bodyClassName="p-3 sm:p-5">
      <AvailabilityCalendar
        key={week.toISOString()}
        weekStartIso={new Date(week.getTime()).toISOString()}
        intervals={intervals}
        previous={previous}
        prevWeek={weeksAhead > 0 ? isoDay(new Date(prevStart.getTime())) : null}
        nextWeek={weeksAhead < MAX_WEEKS_AHEAD ? isoDay(new Date(end.getTime())) : null}
        nowMs={Date.now()}
      />
    </Frame>
  );
}
