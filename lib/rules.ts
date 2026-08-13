/**
 * Booking eligibility and availability, as pure functions.
 *
 * Everything the server needs to accept or reject a booking lives here, with no
 * database access, so the rules can be tested exhaustively. The database still
 * has the final say on double-booking via a partial unique index; this module
 * decides everything else, works out what the slot costs, and produces the
 * message the resident sees.
 */

import type { BookerType } from './owner';
import {
  type Pricing,
  type ScheduleConfig,
  type Slot,
  type Sport,
  type Tier,
  courtNumbers,
  dailyCapacity,
  getSlot,
  isValidCourtNo,
  isValidSlotIndex,
  openSlots,
  priceFor,
  sportForDate,
  tierForSlot,
  tierLabel,
  tierRangeLabel,
} from './schedule';
import {
  type DateStr,
  type ManilaMoment,
  addDays,
  daysBetween,
  formatShortDate,
  isSameWeek,
} from './time';

export type BookingLimits = {
  enabled: boolean;
  /** Max active free bookings a booker may hold on one date. */
  maxPerDay: number;
  /** Max active free bookings a booker may hold in one Monday–Sunday week. */
  maxPerWeek: number;
  /** How many days ahead of today a booking may be made. */
  advanceDays: number;
};

export const DEFAULT_LIMITS: BookingLimits = {
  enabled: true,
  maxPerDay: 1,
  maxPerWeek: 2,
  advanceDays: 7,
};

export type Closure = {
  dateFrom: DateStr;
  dateTo: DateStr;
  /** null closes every slot that day. */
  slotIndex: number | null;
  /** null closes every court. */
  courtNo: number | null;
  reason: string;
};

/** An active booking, reduced to what the rules need. */
export type ActiveBooking = {
  date: DateStr;
  slotIndex: number;
  courtNo: number;
};

/**
 * The person or household making the booking — a resident unit or a guest
 * identified by phone.
 */
export type BookerState = {
  isBlocked: boolean;
  /** Active bookings they hold. Only free ones count against the limits. */
  bookings: { date: DateStr; tier: Tier }[];
};

export const EMPTY_BOOKER: BookerState = { isBlocked: false, bookings: [] };

export type RejectionCode =
  | 'invalid_slot'
  | 'invalid_court'
  | 'closed_hours'
  | 'guest_free_hours'
  | 'past'
  | 'too_far'
  | 'booker_blocked'
  | 'closed'
  | 'day_limit'
  | 'week_limit'
  | 'taken';

export type BookingCheck =
  | { ok: true; tier: Tier; price: number }
  | { ok: false; code: RejectionCode; message: string };

function reject(code: RejectionCode, message: string): BookingCheck {
  return { ok: false, code, message };
}

/** Returns the closure covering this exact court-slot, or null. */
export function findClosure(
  closures: readonly Closure[],
  date: DateStr,
  slotIndex: number,
  courtNo: number,
): Closure | null {
  for (const closure of closures) {
    const withinRange =
      daysBetween(closure.dateFrom, date) >= 0 &&
      daysBetween(date, closure.dateTo) >= 0;
    if (!withinRange) continue;
    if (closure.slotIndex !== null && closure.slotIndex !== slotIndex) continue;
    if (closure.courtNo !== null && closure.courtNo !== courtNo) continue;
    return closure;
  }
  return null;
}

/** A slot is bookable only strictly before it begins. */
export function isPastSlot(
  date: DateStr,
  slot: Slot,
  now: ManilaMoment,
): boolean {
  const dayDelta = daysBetween(now.date, date);
  if (dayDelta < 0) return true;
  if (dayDelta > 0) return false;
  return now.minutes >= slot.startMinutes;
}

export type BookerUsage = {
  dayUsed: number;
  dayMax: number;
  weekUsed: number;
  weekMax: number;
};

/**
 * How much of their free allowance the booker has spent, relative to `date`.
 * Paid bookings are deliberately excluded — the allowance exists to share out
 * the free morning, not to cap what someone pays for.
 */
export function bookerUsage(
  booker: BookerState,
  date: DateStr,
  limits: BookingLimits,
): BookerUsage {
  let dayUsed = 0;
  let weekUsed = 0;
  for (const booking of booker.bookings) {
    if (booking.tier !== 'free') continue;
    if (booking.date === date) dayUsed += 1;
    if (isSameWeek(booking.date, date)) weekUsed += 1;
  }
  return {
    dayUsed,
    dayMax: limits.maxPerDay,
    weekUsed,
    weekMax: limits.maxPerWeek,
  };
}

export type BookingRequest = {
  date: DateStr;
  slotIndex: number;
  courtNo: number;
  bookerType: BookerType;
  now: ManilaMoment;
  limits: BookingLimits;
  schedule: ScheduleConfig;
  pricing: Pricing;
  closures: readonly Closure[];
  /** Active bookings already held on `date`, by anyone. */
  taken: readonly ActiveBooking[];
  booker: BookerState;
};

export function checkBooking(request: BookingRequest): BookingCheck {
  const {
    date,
    slotIndex,
    courtNo,
    bookerType,
    now,
    limits,
    schedule,
    pricing,
    closures,
    taken,
    booker,
  } = request;

  if (!isValidSlotIndex(slotIndex)) {
    return reject('invalid_slot', 'That time slot does not exist.');
  }

  const sport = sportForDate(date);
  if (!isValidCourtNo(sport, courtNo)) {
    return reject('invalid_court', 'That court is not available on this day.');
  }

  const tier = tierForSlot(slotIndex, schedule);
  if (tier === null) {
    return reject('closed_hours', 'The courts are closed at that hour.');
  }

  // The free morning is a resident benefit; guests pay for court time.
  if (tier === 'free' && bookerType === 'guest') {
    return reject(
      'guest_free_hours',
      'The free morning hours are for Brookfield residents. Guests can book from ' +
        `${formatHour(schedule.freeUntilHour)} onwards.`,
    );
  }

  const slot = getSlot(slotIndex);

  if (isPastSlot(date, slot, now)) {
    return reject('past', 'That time has already started.');
  }

  const daysAhead = daysBetween(now.date, date);
  if (limits.enabled && daysAhead > limits.advanceDays) {
    return reject(
      'too_far',
      `Bookings open ${limits.advanceDays} days in advance.`,
    );
  }

  if (booker.isBlocked) {
    return reject(
      'booker_blocked',
      'This unit cannot book right now. Please contact the association office.',
    );
  }

  const closure = findClosure(closures, date, slotIndex, courtNo);
  if (closure) {
    return reject('closed', `Court closed — ${closure.reason}.`);
  }

  // Limits guard the free morning only.
  if (limits.enabled && tier === 'free') {
    const usage = bookerUsage(booker, date, limits);
    if (usage.dayUsed >= usage.dayMax) {
      return reject(
        'day_limit',
        `You already have a free booking on ${formatShortDate(date)}.`,
      );
    }
    if (usage.weekUsed >= usage.weekMax) {
      return reject(
        'week_limit',
        `You have used all ${usage.weekMax} free bookings for that week.`,
      );
    }
  }

  const isTaken = taken.some(
    (booking) =>
      booking.date === date &&
      booking.slotIndex === slotIndex &&
      booking.courtNo === courtNo,
  );
  if (isTaken) {
    return reject('taken', 'Someone just booked this slot. Please pick another.');
  }

  return { ok: true, tier, price: priceFor(tier, sport, pricing) };
}

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00 ${suffix}`;
}

export type CourtStatus = 'open' | 'taken' | 'closed' | 'past';

export type CourtAvailability = {
  courtNo: number;
  status: CourtStatus;
  /** Present when status is 'closed'. */
  reason?: string;
};

export type SlotAvailability = {
  slotIndex: number;
  label: string;
  startMinutes: number;
  tier: Tier;
  price: number;
  courts: CourtAvailability[];
  openCount: number;
};

export type TierGroup = {
  tier: Tier;
  label: string;
  rangeLabel: string;
  /** Price for this day's sport; 0 for the free morning. */
  price: number;
  slots: SlotAvailability[];
  openCount: number;
  capacity: number;
};

export type DayAvailability = {
  date: DateStr;
  sport: Sport;
  groups: TierGroup[];
  openCount: number;
  capacity: number;
  /** False when the date is outside the booking window entirely. */
  withinWindow: boolean;
};

export type AvailabilityRequest = {
  date: DateStr;
  now: ManilaMoment;
  limits: BookingLimits;
  schedule: ScheduleConfig;
  pricing: Pricing;
  closures: readonly Closure[];
  taken: readonly ActiveBooking[];
};

const TIER_ORDER: Tier[] = ['free', 'day', 'night'];

export function computeDayAvailability(
  request: AvailabilityRequest,
): DayAvailability {
  const { date, now, limits, schedule, pricing, closures, taken } = request;
  const sport = sportForDate(date);
  const courts = courtNumbers(sport);

  const takenKeys = new Set(
    taken
      .filter((booking) => booking.date === date)
      .map((booking) => `${booking.slotIndex}:${booking.courtNo}`),
  );

  const bySlot = new Map<number, SlotAvailability>();
  for (const slot of openSlots(schedule)) {
    const tier = tierForSlot(slot.index, schedule)!;
    const past = isPastSlot(date, slot, now);

    const courtStates = courts.map<CourtAvailability>((courtNo) => {
      if (past) return { courtNo, status: 'past' };
      const closure = findClosure(closures, date, slot.index, courtNo);
      if (closure) {
        return { courtNo, status: 'closed', reason: closure.reason };
      }
      if (takenKeys.has(`${slot.index}:${courtNo}`)) {
        return { courtNo, status: 'taken' };
      }
      return { courtNo, status: 'open' };
    });

    bySlot.set(slot.index, {
      slotIndex: slot.index,
      label: slot.label,
      startMinutes: slot.startMinutes,
      tier,
      price: priceFor(tier, sport, pricing),
      courts: courtStates,
      openCount: courtStates.filter((court) => court.status === 'open').length,
    });
  }

  const groups: TierGroup[] = [];
  for (const tier of TIER_ORDER) {
    const slots = [...bySlot.values()].filter((slot) => slot.tier === tier);
    if (slots.length === 0) continue;

    groups.push({
      tier,
      label: tierLabel(tier),
      rangeLabel: tierRangeLabel(tier, schedule),
      price: priceFor(tier, sport, pricing),
      slots,
      openCount: slots.reduce((total, slot) => total + slot.openCount, 0),
      capacity: slots.length * courts.length,
    });
  }

  const daysAhead = daysBetween(now.date, date);
  const withinWindow =
    daysAhead >= 0 && (!limits.enabled || daysAhead <= limits.advanceDays);

  return {
    date,
    sport,
    groups,
    openCount: groups.reduce((total, group) => total + group.openCount, 0),
    capacity: dailyCapacity(date, schedule),
    withinWindow,
  };
}

/** Finds one slot in a computed day, regardless of tier. */
export function findSlotAvailability(
  day: DayAvailability,
  slotIndex: number,
): SlotAvailability | null {
  for (const group of day.groups) {
    const slot = group.slots.find((entry) => entry.slotIndex === slotIndex);
    if (slot) return slot;
  }
  return null;
}

/** The dates a booker may choose from, starting today. */
export function bookableDates(
  now: ManilaMoment,
  limits: BookingLimits,
): DateStr[] {
  const span = limits.enabled ? limits.advanceDays : DEFAULT_LIMITS.advanceDays;
  const dates: DateStr[] = [];
  for (let offset = 0; offset <= span; offset += 1) {
    dates.push(addDays(now.date, offset));
  }
  return dates;
}
