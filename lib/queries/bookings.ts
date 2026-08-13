import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  notInArray,
} from 'drizzle-orm';

import { generateBookingCode } from '@/lib/booking-code';
import { bookingResources, bookings, db, units, type Booking } from '@/lib/db';
import {
  type BookerType,
  type Owner,
  phoneOwner,
  unitOwner,
} from '@/lib/owner';
import {
  type BookerState,
  type HeldResource,
  type RejectionCode,
  checkBooking,
} from '@/lib/rules';
import { isValidSlotIndex, sportForDate } from '@/lib/schedule';
import {
  addDays,
  isValidDateStr,
  manilaNow,
  weekStart,
  type DateStr,
} from '@/lib/time';
import {
  isCompleteUnit,
  isValidPhilippineMobile,
  normalizePhone,
  type UnitInput,
} from '@/lib/unit-key';

import { getClosures } from './closures';
import { getSettings } from './settings';
import { findOrCreateUnit, findUnitByKey } from './units';

/**
 * Statuses that occupy a slot. A request holds its slot from the moment it is
 * made — only a cancellation or a rejection gives it back.
 */
const OCCUPYING = notInArray(bookings.status, ['cancelled', 'rejected']);

/** Statuses a booker still owns and can act on. */
const LIVE = inArray(bookings.status, ['pending', 'confirmed']);

/**
 * Every piece of court held over the range, with the option holding it so the
 * screens can say what is in the way.
 */
export async function getHeldResources(
  from: DateStr,
  to: DateStr,
): Promise<HeldResource[]> {
  const rows = await db
    .select({
      date: bookingResources.bookingDate,
      slotIndex: bookingResources.slotIndex,
      resourceKey: bookingResources.resourceKey,
      optionKey: bookings.courtOption,
    })
    .from(bookingResources)
    .innerJoin(bookings, eq(bookingResources.bookingId, bookings.id))
    .where(
      and(
        gte(bookingResources.bookingDate, from),
        lte(bookingResources.bookingDate, to),
      ),
    );

  return rows as HeldResource[];
}

/**
 * The booker's live bookings across the window that matters for limits.
 *
 * The range starts at the Monday of the current week, not today: a booking
 * earlier this week has already spent part of the weekly allowance even though
 * it is in the past.
 */
export async function getBookerState(
  owner: Owner,
  today: DateStr,
  advanceDays: number,
): Promise<BookerState> {
  const withinWindow = and(
    OCCUPYING,
    gte(bookings.bookingDate, weekStart(today)),
    lte(bookings.bookingDate, addDays(today, advanceDays)),
  );
  // Free court time is what the allowance rations, and 'free' is the amount
  // charged rather than the hour of day — basketball costs money all morning.
  const columns = {
    date: bookings.bookingDate,
    amount: bookings.amount,
  };
  const toState = (rows: { date: string; amount: number }[]) =>
    rows.map((row) => ({ date: row.date, isFree: row.amount === 0 }));

  if (owner.kind === 'phone') {
    const rows = await db
      .select(columns)
      .from(bookings)
      .where(and(eq(bookings.phone, owner.key), withinWindow));
    return { isBlocked: false, bookings: toState(rows) };
  }

  const unit = await findUnitByKey(owner.key);
  if (!unit) return { isBlocked: false, bookings: [] };

  const rows = await db
    .select(columns)
    .from(bookings)
    .where(and(eq(bookings.unitId, unit.id), withinWindow));

  return { isBlocked: unit.isBlocked, bookings: toState(rows) };
}

export type CreateBookingInput = {
  date: DateStr;
  slotIndex: number;
  optionKey: string;
  name: string;
  phone: string;
  bookerType: BookerType;
  /** Required for residents, ignored for guests. */
  phase?: string;
  block?: string;
  lot?: string;
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

/**
 * Creates a booking *request*. Nothing is confirmed until the association
 * approves it, but the slot is held from this moment.
 */
export async function createBooking(
  input: CreateBookingInput,
  now: Date = new Date(),
): Promise<CreateBookingResult> {
  if (!isValidDateStr(input.date)) return invalid('Please choose a date.');

  const name = input.name.trim();
  if (name.length < 2) return invalid('Please enter your full name.');
  if (!isValidPhilippineMobile(input.phone)) {
    return invalid('Please enter a valid mobile number, e.g. 0917 123 4567.');
  }
  if (!isValidSlotIndex(input.slotIndex)) {
    return invalid('Please choose a time slot.');
  }

  const isResident = input.bookerType === 'resident';
  const unitInput: UnitInput = {
    phase: input.phase ?? '',
    block: input.block ?? '',
    lot: input.lot ?? '',
  };

  if (isResident && !isCompleteUnit(unitInput)) {
    return invalid('Please fill in your phase, block and lot.');
  }

  const sport = sportForDate(input.date);
  const moment = manilaNow(now);
  const { limits, schedule, pricing, courts } = await getSettings();
  const owner: Owner = isResident
    ? unitOwner(unitInput)
    : phoneOwner(input.phone);

  const [closures, held, bookerState] = await Promise.all([
    getClosures(input.date, input.date),
    getHeldResources(input.date, input.date),
    getBookerState(owner, moment.date, limits.advanceDays),
  ]);

  const verdict = checkBooking({
    date: input.date,
    slotIndex: input.slotIndex,
    optionKey: input.optionKey,
    bookerType: input.bookerType,
    now: moment,
    limits,
    schedule,
    pricing,
    courts,
    closures,
    held,
    booker: bookerState,
  });

  if (!verdict.ok) {
    return { ok: false, code: verdict.code, message: verdict.message };
  }

  const unit = isResident ? await findOrCreateUnit(unitInput) : null;
  const option = verdict.option;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let created: Booking;
    try {
      const [row] = await db
        .insert(bookings)
        .values({
          code: generateBookingCode(),
          bookingDate: input.date,
          slotIndex: input.slotIndex,
          sport,
          courtOption: option.key,
          courtNo: legacyCourtNo(option.key),
          bookerType: input.bookerType,
          tier: verdict.tier,
          amount: verdict.price,
          paymentStatus: verdict.price > 0 ? 'unpaid' : 'none',
          unitId: unit?.id ?? null,
          bookerName: name,
          phone: normalizePhone(input.phone),
          status: 'pending',
        })
        .returning();
      created = row;
    } catch (error) {
      // Astronomically unlikely; retry with a fresh code.
      if (isUniqueViolation(error, 'bookings_code_idx')) continue;
      throw error;
    }

    // Claiming the physical resources is what actually holds the slot, and the
    // unique index on them is the real guard against two people tapping the
    // same court at the same moment.
    try {
      await db.insert(bookingResources).values(
        option.resources.map((resourceKey) => ({
          bookingId: created.id,
          bookingDate: input.date,
          slotIndex: input.slotIndex,
          resourceKey,
        })),
      );
      return { ok: true, booking: created };
    } catch (error) {
      await db.delete(bookings).where(eq(bookings.id, created.id));
      if (isUniqueViolation(error, 'booking_resources_slot_idx')) {
        return {
          ok: false,
          code: 'taken',
          message: 'Someone just booked this court. Please pick another.',
        };
      }
      throw error;
    }
  }

  return invalid('Could not create the booking. Please try again.');
}

/** Display-only number kept for the CSV export and older rows. */
function legacyCourtNo(optionKey: string): number {
  const match = /^pb(\d)$/.exec(optionKey);
  if (match) return Number(match[1]);
  if (optionKey === 'bbB') return 2;
  return 1;
}

/** Releasing the resources is what gives the slot back to everyone else. */
async function releaseResources(bookingId: number): Promise<void> {
  await db
    .delete(bookingResources)
    .where(eq(bookingResources.bookingId, bookingId));
}

/** A booking with its household attached — null on all four for guests. */
export type BookingWithUnit = Booking & {
  unitPhase: string | null;
  unitBlock: string | null;
  unitLot: string | null;
  unitKey: string | null;
};

const bookingWithUnitColumns = {
  id: bookings.id,
  code: bookings.code,
  bookingDate: bookings.bookingDate,
  slotIndex: bookings.slotIndex,
  sport: bookings.sport,
  courtOption: bookings.courtOption,
  courtNo: bookings.courtNo,
  bookerType: bookings.bookerType,
  tier: bookings.tier,
  amount: bookings.amount,
  paymentStatus: bookings.paymentStatus,
  paymentRef: bookings.paymentRef,
  paymentProofUrl: bookings.paymentProofUrl,
  paidAt: bookings.paidAt,
  unitId: bookings.unitId,
  bookerName: bookings.bookerName,
  phone: bookings.phone,
  status: bookings.status,
  decidedAt: bookings.decidedAt,
  decisionNote: bookings.decisionNote,
  cancelledAt: bookings.cancelledAt,
  cancelledBy: bookings.cancelledBy,
  cancelReason: bookings.cancelReason,
  createdAt: bookings.createdAt,
  unitPhase: units.phase,
  unitBlock: units.block,
  unitLot: units.lot,
  unitKey: units.unitKey,
};

/** Guests have no unit row, so the join must not drop their bookings. */
function selectBookings() {
  return db
    .select(bookingWithUnitColumns)
    .from(bookings)
    .leftJoin(units, eq(bookings.unitId, units.id));
}

/** Upcoming live bookings for one household or one guest phone number. */
export async function getUpcomingBookingsForOwner(
  owner: Owner,
  today: DateStr,
): Promise<BookingWithUnit[]> {
  const identity =
    owner.kind === 'unit'
      ? eq(units.unitKey, owner.key)
      : eq(bookings.phone, owner.key);

  return selectBookings()
    .where(and(identity, LIVE, gte(bookings.bookingDate, today)))
    .orderBy(asc(bookings.bookingDate), asc(bookings.slotIndex));
}

export async function getBookingsForDate(
  date: DateStr,
): Promise<BookingWithUnit[]> {
  return selectBookings()
    .where(eq(bookings.bookingDate, date))
    .orderBy(asc(bookings.slotIndex), asc(bookings.courtNo));
}

/** The approval queue: every request still waiting on the association. */
export async function getPendingBookings(
  today: DateStr,
): Promise<BookingWithUnit[]> {
  return selectBookings()
    .where(
      and(eq(bookings.status, 'pending'), gte(bookings.bookingDate, today)),
    )
    .orderBy(asc(bookings.bookingDate), asc(bookings.slotIndex));
}

export async function countPendingBookings(today: DateStr): Promise<number> {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(eq(bookings.status, 'pending'), gte(bookings.bookingDate, today)),
    );
  return rows.length;
}

export async function getBookingByCode(
  code: string,
): Promise<BookingWithUnit | null> {
  const [row] = await selectBookings().where(eq(bookings.code, code)).limit(1);
  return row ?? null;
}

export type MutationResult = { ok: true } | { ok: false; message: string };

/**
 * Self-service cancel. Ownership is proven by the same identity used to look
 * the booking up — the household address for residents, the mobile number for
 * guests.
 */
export async function cancelBookingAsOwner(
  bookingId: number,
  owner: Owner,
  now: Date = new Date(),
): Promise<MutationResult> {
  const moment = manilaNow(now);

  const identity =
    owner.kind === 'unit'
      ? eq(units.unitKey, owner.key)
      : eq(bookings.phone, owner.key);

  const [row] = await db
    .select({ id: bookings.id, date: bookings.bookingDate })
    .from(bookings)
    .leftJoin(units, eq(bookings.unitId, units.id))
    .where(and(eq(bookings.id, bookingId), identity, LIVE))
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
    .where(and(eq(bookings.id, bookingId), LIVE));
  await releaseResources(bookingId);

  return { ok: true };
}

/** The payer types in the GCash reference so the association can match it. */
export async function submitPaymentReference(
  bookingId: number,
  owner: Owner,
  reference: string,
): Promise<MutationResult> {
  const trimmed = reference.trim();
  if (trimmed.length < 4) {
    return { ok: false, message: 'Please enter the full reference number.' };
  }

  const identity =
    owner.kind === 'unit'
      ? eq(units.unitKey, owner.key)
      : eq(bookings.phone, owner.key);

  const [row] = await db
    .select({ id: bookings.id, amount: bookings.amount })
    .from(bookings)
    .leftJoin(units, eq(bookings.unitId, units.id))
    .where(and(eq(bookings.id, bookingId), identity, LIVE))
    .limit(1);

  if (!row) return { ok: false, message: 'Booking not found.' };
  if (row.amount <= 0) {
    return { ok: false, message: 'This booking is free — nothing to pay.' };
  }

  await db
    .update(bookings)
    .set({ paymentRef: trimmed, paymentStatus: 'submitted' })
    .where(eq(bookings.id, bookingId));

  return { ok: true };
}

/** Attaches an uploaded screenshot, proving the same ownership as a cancel. */
export async function attachPaymentProof(
  bookingId: number,
  owner: Owner,
  url: string,
): Promise<MutationResult> {
  const identity =
    owner.kind === 'unit'
      ? eq(units.unitKey, owner.key)
      : eq(bookings.phone, owner.key);

  const [row] = await db
    .select({ id: bookings.id, amount: bookings.amount })
    .from(bookings)
    .leftJoin(units, eq(bookings.unitId, units.id))
    .where(and(eq(bookings.id, bookingId), identity, LIVE))
    .limit(1);

  if (!row) return { ok: false, message: 'Booking not found.' };
  if (row.amount <= 0) {
    return { ok: false, message: 'This booking is free — nothing to pay.' };
  }

  await db
    .update(bookings)
    .set({ paymentProofUrl: url, paymentStatus: 'submitted' })
    .where(eq(bookings.id, bookingId));

  return { ok: true };
}

/** Screenshots past their retention window, for the cleanup job. */
export async function getExpiredProofs(
  before: DateStr,
): Promise<{ id: number; url: string }[]> {
  const rows = await db
    .select({ id: bookings.id, url: bookings.paymentProofUrl })
    .from(bookings)
    .where(
      and(
        isNotNull(bookings.paymentProofUrl),
        lte(bookings.bookingDate, before),
      ),
    );

  return rows.filter((row): row is { id: number; url: string } =>
    Boolean(row.url),
  );
}

export async function clearPaymentProof(bookingId: number): Promise<void> {
  await db
    .update(bookings)
    .set({ paymentProofUrl: null })
    .where(eq(bookings.id, bookingId));
}

export async function approveBooking(
  bookingId: number,
  markPaid: boolean,
): Promise<MutationResult> {
  const [current] = await db
    .select({ amount: bookings.amount })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'pending')))
    .limit(1);

  if (!current) {
    return { ok: false, message: 'This request is no longer pending.' };
  }

  const paid = markPaid && current.amount > 0;

  await db
    .update(bookings)
    .set({
      status: 'confirmed',
      decidedAt: new Date(),
      ...(paid ? { paymentStatus: 'paid', paidAt: new Date() } : {}),
    })
    .where(eq(bookings.id, bookingId));

  return { ok: true };
}

export async function rejectBooking(
  bookingId: number,
  note: string,
): Promise<MutationResult> {
  const updated = await db
    .update(bookings)
    .set({
      status: 'rejected',
      decidedAt: new Date(),
      decisionNote: note.trim() || null,
    })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'pending')))
    .returning({ id: bookings.id });

  if (updated.length === 0) {
    return { ok: false, message: 'This request is no longer pending.' };
  }
  await releaseResources(bookingId);
  return { ok: true };
}

export async function markPaymentReceived(
  bookingId: number,
): Promise<MutationResult> {
  const updated = await db
    .update(bookings)
    .set({ paymentStatus: 'paid', paidAt: new Date() })
    .where(and(eq(bookings.id, bookingId), OCCUPYING))
    .returning({ id: bookings.id });

  if (updated.length === 0) {
    return { ok: false, message: 'Booking is no longer active.' };
  }
  return { ok: true };
}

export async function cancelBookingAsAdmin(
  bookingId: number,
  reason: string,
): Promise<MutationResult> {
  const updated = await db
    .update(bookings)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledBy: 'admin',
      cancelReason: reason.trim() || null,
    })
    .where(and(eq(bookings.id, bookingId), LIVE))
    .returning({ id: bookings.id });

  if (updated.length === 0) {
    return { ok: false, message: 'Booking is no longer active.' };
  }
  await releaseResources(bookingId);
  return { ok: true };
}

// A no-show keeps its resources: the hour was used up either way.
export async function markNoShow(bookingId: number): Promise<MutationResult> {
  const updated = await db
    .update(bookings)
    .set({ status: 'no_show' })
    .where(and(eq(bookings.id, bookingId), LIVE))
    .returning({ id: bookings.id });

  if (updated.length === 0) {
    return { ok: false, message: 'Booking is no longer active.' };
  }
  return { ok: true };
}

export async function getRecentDecisions(
  limit = 20,
): Promise<BookingWithUnit[]> {
  return selectBookings()
    .where(inArray(bookings.status, ['confirmed', 'rejected']))
    .orderBy(desc(bookings.decidedAt))
    .limit(limit);
}
