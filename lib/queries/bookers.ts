import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import { blockedPhones, bookings, db, units } from '@/lib/db';
import { normalizePhone } from '@/lib/unit-key';

/**
 * Everyone who has booked, keyed on their mobile number.
 *
 * The number is the one identity every booker has: an address is only given up
 * for free court time, so counting by household would miss every paid booking
 * and every guest.
 */
export type BookerSummary = {
  phone: string;
  /** Most recent name used with this number. */
  name: string;
  bookings: number;
  noShows: number;
  cancellations: number;
  spent: number;
  lastBookingDate: string | null;
  /** Household, when they have ever booked free court time. */
  unitLabel: { phase: string; block: string; lot: string } | null;
  isBlocked: boolean;
  blockedReason: string | null;
};

export async function listBookers(search?: string): Promise<BookerSummary[]> {
  const term = search?.trim();
  const filter = term
    ? or(
        ilike(bookings.phone, `%${normalizePhone(term)}%`),
        ilike(bookings.bookerName, `%${term}%`),
      )
    : undefined;

  const rows = await db
    .select({
      phone: bookings.phone,
      name: sql<string>`(array_agg(${bookings.bookerName} order by ${bookings.createdAt} desc))[1]`,
      bookings: sql<number>`count(*) filter (where ${bookings.status} not in ('cancelled','rejected'))::int`,
      noShows: sql<number>`count(*) filter (where ${bookings.status} = 'no_show')::int`,
      cancellations: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')::int`,
      spent: sql<number>`coalesce(sum(${bookings.amount}) filter (where ${bookings.paymentStatus} = 'paid'), 0)::int`,
      lastBookingDate: sql<string | null>`max(${bookings.bookingDate})::text`,
      phase: sql<string | null>`(array_agg(${units.phase}) filter (where ${units.phase} is not null))[1]`,
      block: sql<string | null>`(array_agg(${units.block}) filter (where ${units.block} is not null))[1]`,
      lot: sql<string | null>`(array_agg(${units.lot}) filter (where ${units.lot} is not null))[1]`,
      blockedReason: blockedPhones.reason,
      isBlocked: sql<boolean>`${blockedPhones.phone} is not null`,
    })
    .from(bookings)
    .leftJoin(units, eq(bookings.unitId, units.id))
    .leftJoin(blockedPhones, eq(blockedPhones.phone, bookings.phone))
    .where(filter)
    .groupBy(bookings.phone, blockedPhones.phone, blockedPhones.reason)
    .orderBy(desc(sql`count(*)`));

  return rows.map((row) => ({
    phone: row.phone,
    name: row.name,
    bookings: row.bookings,
    noShows: row.noShows,
    cancellations: row.cancellations,
    spent: row.spent,
    lastBookingDate: row.lastBookingDate,
    unitLabel:
      row.phase && row.block && row.lot
        ? { phase: row.phase, block: row.block, lot: row.lot }
        : null,
    isBlocked: row.isBlocked,
    blockedReason: row.blockedReason,
  }));
}

export async function isPhoneBlocked(phone: string): Promise<boolean> {
  const [row] = await db
    .select({ phone: blockedPhones.phone })
    .from(blockedPhones)
    .where(eq(blockedPhones.phone, normalizePhone(phone)))
    .limit(1);
  return Boolean(row);
}

export async function setPhoneBlocked(
  phone: string,
  blocked: boolean,
  reason: string | null,
): Promise<void> {
  const normalized = normalizePhone(phone);

  if (!blocked) {
    await db.delete(blockedPhones).where(eq(blockedPhones.phone, normalized));
    return;
  }

  await db
    .insert(blockedPhones)
    .values({ phone: normalized, reason })
    .onConflictDoUpdate({ target: blockedPhones.phone, set: { reason } });
}

/** Bookings made from one number, most recent first. */
export async function getBookerHistory(phone: string, limit = 20) {
  return db
    .select({
      id: bookings.id,
      code: bookings.code,
      bookingDate: bookings.bookingDate,
      slotIndex: bookings.slotIndex,
      courtOption: bookings.courtOption,
      amount: bookings.amount,
      status: bookings.status,
    })
    .from(bookings)
    .where(and(eq(bookings.phone, normalizePhone(phone))))
    .orderBy(desc(bookings.bookingDate), desc(bookings.slotIndex))
    .limit(limit);
}
