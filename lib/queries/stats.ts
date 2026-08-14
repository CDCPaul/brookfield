import { and, desc, gte, lte, sql } from 'drizzle-orm';

import { bookings, db, units } from '@/lib/db';
import type { DateStr } from '@/lib/time';

export type MonthStats = {
  total: number;
  cancelled: number;
  noShow: number;
  residentCount: number;
  guestCount: number;
  pendingCount: number;
  /** Pesos billed on bookings that were not cancelled or declined. */
  billed: number;
  /** Pesos actually marked as received. */
  collected: number;
  bySport: { sport: string; count: number }[];
  byTier: { tier: string; count: number; amount: number }[];
  bySlot: { slotIndex: number; count: number }[];
  /** Busiest bookers, by mobile number — the identity everyone has. */
  topBookers: {
    phone: string;
    name: string;
    count: number;
    spent: number;
  }[];
};

const inRange = (from: DateStr, to: DateStr) =>
  and(gte(bookings.bookingDate, from), lte(bookings.bookingDate, to));

/** Bookings that still stand — neither cancelled by anyone nor declined. */
const STANDING = sql`${bookings.status} not in ('cancelled', 'rejected')`;

export async function getStats(
  from: DateStr,
  to: DateStr,
): Promise<MonthStats> {
  const window = inRange(from, to);
  const standing = and(window, STANDING);

  const [totals] = await db
    .select({
      total: sql<number>`count(*) filter (where ${STANDING})::int`,
      cancelled: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')::int`,
      noShow: sql<number>`count(*) filter (where ${bookings.status} = 'no_show')::int`,
      pendingCount: sql<number>`count(*) filter (where ${bookings.status} = 'pending')::int`,
      residentCount: sql<number>`count(*) filter (where ${STANDING} and ${bookings.bookerType} = 'resident')::int`,
      guestCount: sql<number>`count(*) filter (where ${STANDING} and ${bookings.bookerType} <> 'resident')::int`,
      billed: sql<number>`coalesce(sum(${bookings.amount}) filter (where ${STANDING}), 0)::int`,
      collected: sql<number>`coalesce(sum(${bookings.amount}) filter (where ${bookings.paymentStatus} = 'paid'), 0)::int`,
    })
    .from(bookings)
    .where(window);

  const bySport = await db
    .select({ sport: bookings.sport, count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(standing)
    .groupBy(bookings.sport);

  const byTier = await db
    .select({
      tier: bookings.tier,
      count: sql<number>`count(*)::int`,
      amount: sql<number>`coalesce(sum(${bookings.amount}), 0)::int`,
    })
    .from(bookings)
    .where(standing)
    .groupBy(bookings.tier);

  const bySlot = await db
    .select({
      slotIndex: bookings.slotIndex,
      count: sql<number>`count(*)::int`,
    })
    .from(bookings)
    .where(standing)
    .groupBy(bookings.slotIndex)
    .orderBy(bookings.slotIndex);

  const topBookers = await db
    .select({
      phone: bookings.phone,
      name: sql<string>`(array_agg(${bookings.bookerName} order by ${bookings.createdAt} desc))[1]`,
      count: sql<number>`count(*)::int`,
      spent: sql<number>`coalesce(sum(${bookings.amount}) filter (where ${bookings.paymentStatus} = 'paid'), 0)::int`,
    })
    .from(bookings)
    .where(standing)
    .groupBy(bookings.phone)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    total: totals?.total ?? 0,
    cancelled: totals?.cancelled ?? 0,
    noShow: totals?.noShow ?? 0,
    pendingCount: totals?.pendingCount ?? 0,
    residentCount: totals?.residentCount ?? 0,
    guestCount: totals?.guestCount ?? 0,
    billed: totals?.billed ?? 0,
    collected: totals?.collected ?? 0,
    bySport,
    byTier,
    bySlot: bySlot.map((row) => ({ slotIndex: row.slotIndex, count: row.count })),
    topBookers,
  };
}

export type ExportRow = {
  date: string;
  slot: number;
  sport: string;
  court: number;
  bookerType: string;
  tier: string;
  amount: number;
  paymentStatus: string;
  paymentRef: string | null;
  name: string;
  phase: string | null;
  block: string | null;
  lot: string | null;
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
      bookerType: bookings.bookerType,
      tier: bookings.tier,
      amount: bookings.amount,
      paymentStatus: bookings.paymentStatus,
      paymentRef: bookings.paymentRef,
      name: bookings.bookerName,
      phase: units.phase,
      block: units.block,
      lot: units.lot,
      phone: bookings.phone,
      status: bookings.status,
      bookedAt: bookings.createdAt,
    })
    .from(bookings)
    // Left join: guests have no unit row and must still appear in the export.
    .leftJoin(units, sql`${units.id} = ${bookings.unitId}`)
    .where(inRange(from, to))
    .orderBy(bookings.bookingDate, bookings.slotIndex, bookings.courtNo);
}
