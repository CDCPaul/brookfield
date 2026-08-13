import { and, desc, gte, lte, sql } from 'drizzle-orm';

import { bookings, db, units } from '@/lib/db';
import type { DateStr } from '@/lib/time';

export type MonthStats = {
  total: number;
  cancelled: number;
  noShow: number;
  bySport: { sport: string; count: number }[];
  bySlot: { slotIndex: number; count: number }[];
  topUnits: {
    unitKey: string;
    phase: string;
    block: string;
    lot: string;
    count: number;
  }[];
};

const inRange = (from: DateStr, to: DateStr) =>
  and(gte(bookings.bookingDate, from), lte(bookings.bookingDate, to));

export async function getStats(
  from: DateStr,
  to: DateStr,
): Promise<MonthStats> {
  const [totals] = await db
    .select({
      total: sql<number>`count(*) filter (where ${bookings.status} <> 'cancelled')::int`,
      cancelled: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')::int`,
      noShow: sql<number>`count(*) filter (where ${bookings.status} = 'no_show')::int`,
    })
    .from(bookings)
    .where(inRange(from, to));

  const bySport = await db
    .select({
      sport: bookings.sport,
      count: sql<number>`count(*)::int`,
    })
    .from(bookings)
    .where(and(inRange(from, to), sql`${bookings.status} <> 'cancelled'`))
    .groupBy(bookings.sport);

  const bySlot = await db
    .select({
      slotIndex: bookings.slotIndex,
      count: sql<number>`count(*)::int`,
    })
    .from(bookings)
    .where(and(inRange(from, to), sql`${bookings.status} <> 'cancelled'`))
    .groupBy(bookings.slotIndex)
    .orderBy(bookings.slotIndex);

  const topUnits = await db
    .select({
      unitKey: units.unitKey,
      // Returned raw so the display label goes through the same normalization
      // as everywhere else (lib/unit-key.ts), not a second format built in SQL.
      phase: units.phase,
      block: units.block,
      lot: units.lot,
      count: sql<number>`count(*)::int`,
    })
    .from(bookings)
    .innerJoin(units, sql`${units.id} = ${bookings.unitId}`)
    .where(and(inRange(from, to), sql`${bookings.status} <> 'cancelled'`))
    .groupBy(units.id)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    total: totals?.total ?? 0,
    cancelled: totals?.cancelled ?? 0,
    noShow: totals?.noShow ?? 0,
    bySport,
    bySlot: bySlot.map((row) => ({ slotIndex: row.slotIndex, count: row.count })),
    topUnits,
  };
}

export type ExportRow = {
  date: string;
  slot: number;
  sport: string;
  court: number;
  name: string;
  phase: string;
  block: string;
  lot: string;
  phone: string;
  status: string;
  bookedAt: Date;
};

export async function getExportRows(
  from: DateStr,
  to: DateStr,
): Promise<ExportRow[]> {
  return db
    .select({
      date: bookings.bookingDate,
      slot: bookings.slotIndex,
      sport: bookings.sport,
      court: bookings.courtNo,
      name: bookings.bookerName,
      phase: units.phase,
      block: units.block,
      lot: units.lot,
      phone: bookings.phone,
      status: bookings.status,
      bookedAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(units, sql`${units.id} = ${bookings.unitId}`)
    .where(inRange(from, to))
    .orderBy(bookings.bookingDate, bookings.slotIndex, bookings.courtNo);
}
