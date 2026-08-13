import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { generateBookingCode } from '@/lib/booking-code';
import { bookings, db, units, type Booking } from '@/lib/db';
import {
  type ActiveBooking,
  type RejectionCode,
  type UnitState,
  checkBooking,
} from '@/lib/rules';
import { isValidCourtNo, isValidSlotIndex, sportForDate } from '@/lib/schedule';
import {
  addDays,
  isValidDateStr,
  manilaNow,
  weekStart,
  type DateStr,
} from '@/lib/time';
import {
  buildUnitKey,
  isCompleteUnit,
  isValidPhilippineMobile,
  normalizePhone,
  type UnitInput,
} from '@/lib/unit-key';

import { getClosures } from './closures';
import { getLimits } from './settings';
import { findOrCreateUnit, findUnitByKey } from './units';

const ACTIVE = eq(bookings.status, 'booked');

export async function getActiveBookings(
  from: DateStr,
  to: DateStr,
): Promise<ActiveBooking[]> {
  const rows = await db
    .select({
      date: bookings.bookingDate,
      slotIndex: bookings.slotIndex,
      courtNo: bookings.courtNo,
    })
    .from(bookings)
    .where(
      and(ACTIVE, gte(bookings.bookingDate, from), lte(bookings.bookingDate, to)),
    );
  return rows;
}

/**
 * The unit's active bookings across the window that matters for limits.
 *
 * The range starts at the Monday of the current week, not today: a booking
 * earlier this week has already spent part of the weekly allowance even though
 * it is in the past.
 */
export async function getUnitState(
  unitKey: string,
  today: DateStr,
  advanceDays: number,
): Promise<UnitState> {
  const unit = await findUnitByKey(unitKey);
  if (!unit) return { isBlocked: false, bookings: [] };

  const from = weekStart(today);
  const to = addDays(today, advanceDays);

  const rows = await db
    .select({ date: bookings.bookingDate })
    .from(bookings)
    .where(
      and(
        eq(bookings.unitId, unit.id),
        ACTIVE,
        gte(bookings.bookingDate, from),
        lte(bookings.bookingDate, to),
      ),
    );

  return { isBlocked: unit.isBlocked, bookings: rows };
}

export type CreateBookingInput = UnitInput & {
  date: DateStr;
  slotIndex: number;
  courtNo: number;
  name: string;
  phone: string;
};

export type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; code: RejectionCode | 'invalid_input'; message: string };

function invalid(message: string): CreateBookingResult {
  return { ok: false, code: 'invalid_input', message };
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const candidate = error as {
    code?: string;
    constraint?: string;
    message?: string;
  };
  if (candidate?.code !== '23505') return false;
  return (
    candidate.constraint === constraint ||
    (candidate.message?.includes(constraint) ?? false)
  );
}

export async function createBooking(
  input: CreateBookingInput,
  now: Date = new Date(),
): Promise<CreateBookingResult> {
  if (!isValidDateStr(input.date)) return invalid('Please choose a date.');

  const name = input.name.trim();
  if (name.length < 2) return invalid('Please enter your full name.');
  if (!isCompleteUnit(input)) {
    return invalid('Please fill in your phase, block and lot.');
  }
  if (!isValidPhilippineMobile(input.phone)) {
    return invalid('Please enter a valid mobile number, e.g. 0917 123 4567.');
  }
  if (!isValidSlotIndex(input.slotIndex)) {
    return invalid('Please choose a time slot.');
  }

  const sport = sportForDate(input.date);
  if (!isValidCourtNo(sport, input.courtNo)) {
    return invalid('Please choose a court.');
  }

  const moment = manilaNow(now);
  const limits = await getLimits();
  const unitKey = buildUnitKey(input);

  const [closures, taken, unitState] = await Promise.all([
    getClosures(input.date, input.date),
    getActiveBookings(input.date, input.date),
    getUnitState(unitKey, moment.date, limits.advanceDays),
  ]);

  const verdict = checkBooking({
    date: input.date,
    slotIndex: input.slotIndex,
    courtNo: input.courtNo,
    now: moment,
    limits,
    closures,
    taken,
    unit: unitState,
  });

  if (!verdict.ok) {
    return { ok: false, code: verdict.code, message: verdict.message };
  }

  const unit = await findOrCreateUnit(input);

  // The partial unique index is the real guard against a race between two
  // residents tapping the same court at the same moment.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [row] = await db
        .insert(bookings)
        .values({
          code: generateBookingCode(),
          bookingDate: input.date,
          slotIndex: input.slotIndex,
          sport,
          courtNo: input.courtNo,
          unitId: unit.id,
          bookerName: name,
          phone: normalizePhone(input.phone),
        })
        .returning();
      return { ok: true, booking: row };
    } catch (error) {
      if (isUniqueViolation(error, 'bookings_active_slot_idx')) {
        return {
          ok: false,
          code: 'taken',
          message: 'Someone just booked this slot. Please pick another.',
        };
      }
      if (isUniqueViolation(error, 'bookings_code_idx')) {
        continue; // Astronomically unlikely; retry with a fresh code.
      }
      throw error;
    }
  }

  return invalid('Could not create the booking. Please try again.');
}

export type BookingWithUnit = Booking & {
  unitPhase: string;
  unitBlock: string;
  unitLot: string;
  unitKey: string;
};

const bookingWithUnitColumns = {
  id: bookings.id,
  code: bookings.code,
  bookingDate: bookings.bookingDate,
  slotIndex: bookings.slotIndex,
  sport: bookings.sport,
  courtNo: bookings.courtNo,
  unitId: bookings.unitId,
  bookerName: bookings.bookerName,
  phone: bookings.phone,
  status: bookings.status,
  cancelledAt: bookings.cancelledAt,
  cancelledBy: bookings.cancelledBy,
  cancelReason: bookings.cancelReason,
  createdAt: bookings.createdAt,
  unitPhase: units.phase,
  unitBlock: units.block,
  unitLot: units.lot,
  unitKey: units.unitKey,
};

/** Upcoming active bookings for one household. */
export async function getUpcomingBookingsForUnit(
  unitKey: string,
  today: DateStr,
): Promise<BookingWithUnit[]> {
  return db
    .select(bookingWithUnitColumns)
    .from(bookings)
    .innerJoin(units, eq(bookings.unitId, units.id))
    .where(
      and(eq(units.unitKey, unitKey), ACTIVE, gte(bookings.bookingDate, today)),
    )
    .orderBy(asc(bookings.bookingDate), asc(bookings.slotIndex));
}

export async function getBookingsForDate(
  date: DateStr,
): Promise<BookingWithUnit[]> {
  return db
    .select(bookingWithUnitColumns)
    .from(bookings)
    .innerJoin(units, eq(bookings.unitId, units.id))
    .where(eq(bookings.bookingDate, date))
    .orderBy(asc(bookings.slotIndex), asc(bookings.courtNo));
}

export async function getBookingByCode(
  code: string,
): Promise<BookingWithUnit | null> {
  const [row] = await db
    .select(bookingWithUnitColumns)
    .from(bookings)
    .innerJoin(units, eq(bookings.unitId, units.id))
    .where(eq(bookings.code, code))
    .limit(1);
  return row ?? null;
}

export type CancelResult = { ok: true } | { ok: false; message: string };

/**
 * Resident-initiated cancel. Ownership is proven by the unit key, which the
 * resident re-enters (or which is remembered on their phone).
 */
export async function cancelBookingAsResident(
  bookingId: number,
  unitKey: string,
  now: Date = new Date(),
): Promise<CancelResult> {
  const moment = manilaNow(now);

  const [row] = await db
    .select({ id: bookings.id, date: bookings.bookingDate })
    .from(bookings)
    .innerJoin(units, eq(bookings.unitId, units.id))
    .where(and(eq(bookings.id, bookingId), eq(units.unitKey, unitKey), ACTIVE))
    .limit(1);

  if (!row) return { ok: false, message: 'Booking not found.' };
  if (row.date < moment.date) {
    return { ok: false, message: 'Past bookings cannot be cancelled.' };
  }

  await db
    .update(bookings)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledBy: 'resident',
    })
    .where(and(eq(bookings.id, bookingId), ACTIVE));

  return { ok: true };
}

export async function cancelBookingAsAdmin(
  bookingId: number,
  reason: string,
): Promise<CancelResult> {
  const updated = await db
    .update(bookings)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledBy: 'admin',
      cancelReason: reason.trim() || null,
    })
    .where(and(eq(bookings.id, bookingId), ACTIVE))
    .returning({ id: bookings.id });

  if (updated.length === 0) {
    return { ok: false, message: 'Booking is no longer active.' };
  }
  return { ok: true };
}

export async function markNoShow(bookingId: number): Promise<CancelResult> {
  const updated = await db
    .update(bookings)
    .set({ status: 'no_show' })
    .where(and(eq(bookings.id, bookingId), ACTIVE))
    .returning({ id: bookings.id });

  if (updated.length === 0) {
    return { ok: false, message: 'Booking is no longer active.' };
  }
  return { ok: true };
}

/** Active bookings covered by a closure, so the admin can act on them. */
export async function getBookingsAffectedByClosure(input: {
  dateFrom: DateStr;
  dateTo: DateStr;
  slotIndex: number | null;
  courtNo: number | null;
}): Promise<BookingWithUnit[]> {
  const conditions = [
    ACTIVE,
    gte(bookings.bookingDate, input.dateFrom),
    lte(bookings.bookingDate, input.dateTo),
  ];
  if (input.slotIndex !== null) {
    conditions.push(eq(bookings.slotIndex, input.slotIndex));
  }
  if (input.courtNo !== null) {
    conditions.push(eq(bookings.courtNo, input.courtNo));
  }

  return db
    .select(bookingWithUnitColumns)
    .from(bookings)
    .innerJoin(units, eq(bookings.unitId, units.id))
    .where(and(...conditions))
    .orderBy(asc(bookings.bookingDate), asc(bookings.slotIndex));
}

export async function getRecentBookings(limit = 50): Promise<BookingWithUnit[]> {
  return db
    .select(bookingWithUnitColumns)
    .from(bookings)
    .innerJoin(units, eq(bookings.unitId, units.id))
    .orderBy(desc(bookings.createdAt))
    .limit(limit);
}

/** Per-date open/booked counts for the date strip. */
export async function getDailyBookedCounts(
  from: DateStr,
  to: DateStr,
): Promise<Map<DateStr, number>> {
  const rows = await db
    .select({
      date: bookings.bookingDate,
      count: sql<number>`count(*)::int`,
    })
    .from(bookings)
    .where(
      and(ACTIVE, gte(bookings.bookingDate, from), lte(bookings.bookingDate, to)),
    )
    .groupBy(bookings.bookingDate);

  return new Map(rows.map((row) => [row.date, row.count]));
}
