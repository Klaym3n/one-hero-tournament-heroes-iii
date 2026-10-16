import "server-only";
import { and, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { db, type DBOrTx } from "@/db";
import { availabilitySlots, matches, participants, slotProposals, tournaments } from "@/db/schema";
import { commonSlots, mergeIntervals, SLOT_MS, type Interval } from "@/lib/scheduling/availability";
import { notifyUsers } from "@/lib/notify";
import { fmtDateTime, fmtTime } from "@/lib/labels";
import { ServiceError } from "./errors";
import type { SessionUser } from "@/lib/auth/session";

const OPEN_STATUSES = ["PENDING", "REPORTED"] as const;
const HORIZON_MS = 8 * 7 * 86_400_000;

async function intervalsFor(tx: DBOrTx, userId: string, now: number): Promise<Interval[]> {
  const rows = await tx
    .select({ s: availabilitySlots.startsAt, e: availabilitySlots.endsAt })
    .from(availabilitySlots)
    .where(and(eq(availabilitySlots.userId, userId), gt(availabilitySlots.endsAt, new Date(now))));
  return rows.map((r) => ({ start: r.s.getTime(), end: r.e.getTime() }));
}

/**
 * Przelicza wspólne terminy graczy meczu. Nowo znaleziony najwcześniejszy termin
 * jest jednorazowo ogłaszany obu graczom (DM + powiadomienie).
 */
export async function refreshProposalsForMatch(matchId: string, tx: DBOrTx = db) {
  const [m] = await tx
    .select({
      id: matches.id,
      status: matches.status,
      a: matches.playerAId,
      b: matches.playerBId,
      scheduledAt: matches.scheduledAt,
      minSlot: tournaments.minSlotMinutes,
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .where(eq(matches.id, matchId));
  if (!m || !m.a || !m.b || !(OPEN_STATUSES as readonly string[]).includes(m.status)) return;

  const ps = await tx
    .select({ id: participants.id, userId: participants.userId, nick: participants.nick })
    .from(participants)
    .where(inArray(participants.id, [m.a, m.b]));
  const pa = ps.find((p) => p.id === m.a);
  const pb = ps.find((p) => p.id === m.b);
  if (!pa || !pb) return;

  const now = Date.now();
  const slots = commonSlots(await intervalsFor(tx, pa.userId, now), await intervalsFor(tx, pb.userId, now), {
    minMinutes: m.minSlot,
    now,
    limit: 5,
  });

  // zastąp przyszłe propozycje aktualnymi (zachowując informację o powiadomieniu)
  const existing = await tx.select().from(slotProposals).where(eq(slotProposals.matchId, m.id));
  const keep = new Set(slots.map((s) => s.start));
  const stale = existing.filter((e) => !keep.has(e.startsAt.getTime())).map((e) => e.id);
  if (stale.length) await tx.delete(slotProposals).where(inArray(slotProposals.id, stale));
  for (const s of slots) {
    await tx
      .insert(slotProposals)
      .values({ matchId: m.id, startsAt: new Date(s.start), endsAt: new Date(s.end) })
      .onConflictDoUpdate({ target: [slotProposals.matchId, slotProposals.startsAt], set: { endsAt: new Date(s.end) } });
  }

  if (m.scheduledAt || !slots.length) return;
  const earliest = slots[0];
  const [row] = await tx
    .select()
    .from(slotProposals)
    .where(and(eq(slotProposals.matchId, m.id), eq(slotProposals.startsAt, new Date(earliest.start))));
  // powiadamiamy tylko, jeśli żaden termin tego meczu nie był jeszcze ogłoszony lub pojawił się wcześniejszy
  const announced = existing.filter((e) => e.notifiedAt && e.startsAt.getTime() <= earliest.start && keep.has(e.startsAt.getTime()));
  if (!row || row.notifiedAt || announced.length) return;

  await tx.update(slotProposals).set({ notifiedAt: new Date() }).where(eq(slotProposals.id, row.id));
  const when = `${fmtDateTime(earliest.start)}–${fmtTime(earliest.end)}`;
  await notifyUsers([pa.userId, pb.userId], {
    type: "SLOT_FOUND",
    title: "Znaleziono wspólny termin meczu",
    body: `${pa.nick} vs ${pb.nick}: oboje jesteście dostępni ${when} (czas polski). Potwierdźcie termin na stronie meczu.`,
    href: `/mecze/${m.id}`,
  }, tx);
}

async function openMatchIdsForUser(tx: DBOrTx, userId: string): Promise<string[]> {
  const ps = await tx.select({ id: participants.id }).from(participants).where(eq(participants.userId, userId));
  if (!ps.length) return [];
  const ids = ps.map((p) => p.id);
  const rows = await tx
    .select({ id: matches.id })
    .from(matches)
    .where(and(inArray(matches.status, [...OPEN_STATUSES]), or(inArray(matches.playerAId, ids), inArray(matches.playerBId, ids))));
  return rows.map((r) => r.id);
}

/**
 * Zapisuje dostępność użytkownika w zakresie [from, to) – zastępuje wcześniejsze wpisy z tego zakresu.
 * Przedziały muszą być wyrównane do 30 minut.
 */
export async function saveAvailability(user: SessionUser, from: Date, to: Date, intervals: Interval[]) {
  const now = Date.now();
  if (!(to > from) || to.getTime() - from.getTime() > 8 * 86_400_000) throw new ServiceError("Nieprawidłowy zakres tygodnia.");
  if (to.getTime() < now - 86_400_000 || from.getTime() > now + HORIZON_MS) throw new ServiceError("Zakres poza dozwolonym okresem.");
  for (const i of intervals) {
    if (i.start % SLOT_MS || i.end % SLOT_MS || i.end <= i.start) throw new ServiceError("Nieprawidłowe przedziały czasu.");
    if (i.start < from.getTime() || i.end > to.getTime()) throw new ServiceError("Przedział poza wybranym tygodniem.");
  }
  if (intervals.length > 400) throw new ServiceError("Zbyt wiele przedziałów.");
  const merged = mergeIntervals(intervals);

  await db.transaction(async (tx) => {
    // usuń wpisy w całości mieszczące się w zakresie, przytnij te, które go przecinają
    const overlapping = await tx
      .select()
      .from(availabilitySlots)
      .where(and(eq(availabilitySlots.userId, user.id), lt(availabilitySlots.startsAt, to), gt(availabilitySlots.endsAt, from)));
    if (overlapping.length) await tx.delete(availabilitySlots).where(inArray(availabilitySlots.id, overlapping.map((o) => o.id)));
    const outside: Interval[] = [];
    for (const o of overlapping) {
      if (o.startsAt < from) outside.push({ start: o.startsAt.getTime(), end: from.getTime() });
      if (o.endsAt > to) outside.push({ start: to.getTime(), end: o.endsAt.getTime() });
    }
    const all = mergeIntervals([...outside, ...merged]);
    if (all.length) {
      await tx.insert(availabilitySlots).values(all.map((i) => ({ userId: user.id, startsAt: new Date(i.start), endsAt: new Date(i.end) })));
    }
    // sprzątanie starych wpisów
    await tx.delete(availabilitySlots).where(and(eq(availabilitySlots.userId, user.id), lt(availabilitySlots.endsAt, new Date(now - 7 * 86_400_000))));
    for (const id of await openMatchIdsForUser(tx, user.id)) await refreshProposalsForMatch(id, tx);
  });
}

export async function getAvailability(userId: string, from: Date, to: Date): Promise<Interval[]> {
  const rows = await db
    .select({ s: availabilitySlots.startsAt, e: availabilitySlots.endsAt })
    .from(availabilitySlots)
    .where(and(eq(availabilitySlots.userId, userId), lt(availabilitySlots.startsAt, to), gt(availabilitySlots.endsAt, from)));
  return rows.map((r) => ({ start: r.s.getTime(), end: r.e.getTime() }));
}

/** Zadanie cykliczne: odśwież propozycje dla otwartych, niezaplanowanych meczów. */
export async function scanAllProposals() {
  const rows = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(inArray(matches.status, [...OPEN_STATUSES]), isNull(matches.scheduledAt)));
  for (const r of rows) await refreshProposalsForMatch(r.id);
  // usuń przeterminowane propozycje
  await db.delete(slotProposals).where(lt(slotProposals.endsAt, new Date()));
  return rows.length;
}

