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
import {
  type CourtOption,
  findOption,
  priceForOption,
} from '@/lib/courts';
import {
  isValidSlotIndex,
  sportForDate,
  tierForSlot,
} from '@/lib/schedule';
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
      bookerName: bookings.bookerName,
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

/** One slot in a request. Several may be asked for together. */
export type Pick = { slotIndex: number; optionKey: string };

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

/** Shared failure shape, so single and multi-slot requests reject alike. */
export type BookingFailure = {
  ok: false;
  code: RejectionCode | 'invalid_input';
  message: string;
};

export type CreateBookingResult = { ok: true; booking: Booking } | BookingFailure;

function invalid(message: string): BookingFailure {
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

  const sport = sportForDate(input.date);
  const moment = manilaNow(now);
  const { limits, schedule, pricing, courts } = await getSettings();

  const unitInput: UnitInput = {
    phase: input.phase ?? '',
    block: input.block ?? '',
    lot: input.lot ?? '',
  };

  // The household address exists to ration free court time. Paid hours are not
  // rationed, so it is not asked for and bookings there are keyed on the phone
  // number like anyone else's.
  const option = findOption(input.optionKey);
  const tier = tierForSlot(input.slotIndex, schedule);
  const isFree =
    option !== null &&
    tier !== null &&
    priceForOption(option, tier, pricing) === 0;

  // Only residents are asked for an address, and only for free court time.
  // A guest here falls through so the rules can explain that the free morning
  // is not theirs to book, rather than demanding an address they do not have.
  if (isFree && input.bookerType === 'resident' && !isCompleteUnit(unitInput)) {
    return invalid('Please fill in your phase, block and lot.');
  }

  const hasUnit = isCompleteUnit(unitInput);
  const owner: Owner = hasUnit
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

  const unit = hasUnit ? await findOrCreateUnit(unitInput) : null;
  const booked = verdict.option;

  const created = await insertBooking({
    date: input.date,
    slotIndex: input.slotIndex,
    sport,
    option: booked,
    bookerType: input.bookerType,
    tier: verdict.tier,
    price: verdict.price,
    unitId: unit?.id ?? null,
    name,
    phone: normalizePhone(input.phone),
  });

  if (!created.ok) return created.error;
  return { ok: true, booking: created.booking };
}

type InsertInput = {
  date: DateStr;
  slotIndex: number;
  sport: string;
  option: CourtOption;
  bookerType: BookerType;
  tier: string;
  price: number;
  unitId: number | null;
  name: string;
  phone: string;
};

/**
 * Writes one booking and claims its resources.
 *
 * The two are inseparable: without the resource rows nothing holds the slot,
 * so a failure to claim them removes the booking rather than leaving one that
 * looks confirmed but blocks nobody.
 */
async function insertBooking(
  input: InsertInput,
): Promise<{ ok: true; booking: Booking } | { ok: false; error: BookingFailure }> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let created: Booking;
    try {
      const [row] = await db
        .insert(bookings)
        .values({
          code: generateBookingCode(),
          bookingDate: input.date,
          slotIndex: input.slotIndex,
          sport: input.sport,
          courtOption: input.option.key,
          courtNo: legacyCourtNo(input.option.key),
          bookerType: input.bookerType,
          tier: input.tier,
          amount: input.price,
          paymentStatus: input.price > 0 ? 'unpaid' : 'none',
          unitId: input.unitId,
          bookerName: input.name,
          phone: input.phone,
          status: 'pending',
        })
        .returning();
      created = row;
    } catch (error) {
      // Astronomically unlikely; retry with a fresh code.
      if (isUniqueViolation(error, 'bookings_code_idx')) continue;
      throw error;
    }

    try {
      await db.insert(bookingResources).values(
        input.option.resources.map((resourceKey) => ({
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
          error: {
            ok: false,
            code: 'taken',
            message: 'Someone just booked this court. Please pick another.',
          },
        };
      }
      throw error;
    }
  }

  return {
    ok: false,
    error: invalid('Could not create the booking. Please try again.'),
  };
}

export type CreateRequestInput = Omit<
  CreateBookingInput,
  'slotIndex' | 'optionKey'
> & { picks: Pick[] };

export type CreateRequestResult =
  | { ok: true; bookings: Booking[]; groupCode: string; total: number }
  | BookingFailure;

/**
 * Requests several slots at once, as one thing to pay for and one thing to
 * decide on.
 *
 * Every pick is checked against the ones already accepted in the same request,
 * so asking for tennis and a pickleball court in the same hour fails rather
 * than half-succeeding. If any pick cannot be had, none are kept.
 */
export async function createRequest(
  input: CreateRequestInput,
  now: Date = new Date(),
): Promise<CreateRequestResult> {
  if (input.picks.length === 0) return invalid('Please choose a time.');
  if (input.picks.length > 8) {
    return invalid('You can request at most 8 hours at a time.');
  }
  if (!isValidDateStr(input.date)) return invalid('Please choose a date.');

  const name = input.name.trim();
  if (name.length < 2) return invalid('Please enter your full name.');
  if (!isValidPhilippineMobile(input.phone)) {
    return invalid('Please enter a valid mobile number, e.g. 0917 123 4567.');
  }

  const sport = sportForDate(input.date);
  const moment = manilaNow(now);
  const { limits, schedule, pricing, courts } = await getSettings();

  const unitInput: UnitInput = {
    phase: input.phase ?? '',
    block: input.block ?? '',
    lot: input.lot ?? '',
  };

  const anyFree = input.picks.some((pick) => {
    const option = findOption(pick.optionKey);
    const tier = tierForSlot(pick.slotIndex, schedule);
    return option && tier && priceForOption(option, tier, pricing) === 0;
  });

  if (anyFree && input.bookerType === 'resident' && !isCompleteUnit(unitInput)) {
    return invalid('Please fill in your phase, block and lot.');
  }

  const hasUnit = isCompleteUnit(unitInput);
  const owner: Owner = hasUnit ? unitOwner(unitInput) : phoneOwner(input.phone);

  const [closures, storedHeld, bookerState] = await Promise.all([
    getClosures(input.date, input.date),
    getHeldResources(input.date, input.date),
    getBookerState(owner, moment.date, limits.advanceDays),
  ]);

  // Grows as picks are accepted, so the request cannot conflict with itself or
  // exceed the free allowance across its own slots.
  const held = [...storedHeld];
  const booker: BookerState = {
    isBlocked: bookerState.isBlocked,
    bookings: [...bookerState.bookings],
  };
  const accepted: { pick: Pick; option: CourtOption; tier: string; price: number }[] =
    [];

  for (const pick of input.picks) {
    const verdict = checkBooking({
      date: input.date,
      slotIndex: pick.slotIndex,
      optionKey: pick.optionKey,
      bookerType: input.bookerType,
      now: moment,
      limits,
      schedule,
      pricing,
      courts,
      closures,
      held,
      booker,
    });

    if (!verdict.ok) {
      return { ok: false, code: verdict.code, message: verdict.message };
    }

    accepted.push({
      pick,
      option: verdict.option,
      tier: verdict.tier,
      price: verdict.price,
    });
    held.push(
      ...verdict.option.resources.map((resourceKey) => ({
        date: input.date,
        slotIndex: pick.slotIndex,
        resourceKey,
        optionKey: verdict.option.key,
        bookerName: name,
      })),
    );
    booker.bookings.push({
      date: input.date,
      isFree: verdict.price === 0,
    });
  }

  const unit = hasUnit ? await findOrCreateUnit(unitInput) : null;
  const phone = normalizePhone(input.phone);
  const madeSoFar: Booking[] = [];

  for (const entry of accepted) {
    const created = await insertBooking({
      date: input.date,
      slotIndex: entry.pick.slotIndex,
      sport,
      option: entry.option,
      bookerType: input.bookerType,
      tier: entry.tier,
      price: entry.price,
      unitId: unit?.id ?? null,
      name,
      phone,
    });

    if (!created.ok) {
      // All or nothing: a half-made request would charge for hours the booker
      // did not get.
      for (const made of madeSoFar) {
        await db.delete(bookings).where(eq(bookings.id, made.id));
      }
      return created.error;
    }
    madeSoFar.push(created.booking);
  }

  const groupCode = madeSoFar[0].code;
  await db
    .update(bookings)
    .set({ groupCode })
    .where(
      inArray(
        bookings.id,
        madeSoFar.map((entry) => entry.id),
      ),
    );

  return {
    ok: true,
    bookings: madeSoFar.map((entry) => ({ ...entry, groupCode })),
    groupCode,
    total: madeSoFar.reduce((sum, entry) => sum + entry.amount, 0),
  };
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
  groupCode: bookings.groupCode,
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

/**
 * Every slot requested together with this one, in time order.
 *
 * A request for three hours is three bookings sharing a group code; the payer
 * sees them as one thing to settle.
 */
export async function getBookingGroup(
  code: string,
): Promise<BookingWithUnit[]> {
  const first = await getBookingByCode(code);
  if (!first) return [];
  if (!first.groupCode) return [first];

  return selectBookings()
    .where(eq(bookings.groupCode, first.groupCode))
    .orderBy(asc(bookings.bookingDate), asc(bookings.slotIndex));
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
