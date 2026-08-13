/**
 * Booking eligibility and availability, as pure functions.
 *
 * Everything the server needs to accept or reject a booking lives here, with no
 * database access, so the rules can be tested exhaustively. The database still
 * has the final say on double-booking via a partial unique index; this module
 * decides everything else and produces the message the resident sees.
 */

import {
  type DateStr,
  type ManilaMoment,
  addDays,
  daysBetween,
  isSameWeek,
  formatShortDate,
} from './time';
import {
  type Sport,
  type Slot,
  SLOTS,
  courtNumbers,
  dailyCapacity,
  getSlot,
  isValidCourtNo,
  isValidSlotIndex,
  sportForDate,
} from './schedule';

export type BookingLimits = {
  enabled: boolean;
  /** Max active bookings a unit may hold on one date. */
  maxPerDay: number;
  /** Max active bookings a unit may hold in one Monday–Sunday week. */
  maxPerWeek: number;
  /** How many days ahead of today a resident may book. */
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

export type UnitState = {
  isBlocked: boolean;
  /** Every active booking held by this unit, across all dates. */
  bookings: { date: DateStr }[];
};

export const EMPTY_UNIT: UnitState = { isBlocked: false, bookings: [] };

export type RejectionCode =
  | 'invalid_slot'
  | 'invalid_court'
  | 'past'
  | 'too_far'
  | 'unit_blocked'
  | 'closed'
  | 'day_limit'
  | 'week_limit'
  | 'taken';

export type BookingCheck =
  | { ok: true }
  | { ok: false; code: RejectionCode; message: string };

const OK: BookingCheck = { ok: true };

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

export type UnitUsage = {
  dayUsed: number;
  dayMax: number;
  weekUsed: number;
  weekMax: number;
};

/** How much of its allowance the unit has spent, relative to `date`. */
export function unitUsage(
  unit: UnitState,
  date: DateStr,
  limits: BookingLimits,
): UnitUsage {
  let dayUsed = 0;
  let weekUsed = 0;
  for (const booking of unit.bookings) {
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
  now: ManilaMoment;
  limits: BookingLimits;
  closures: readonly Closure[];
  /** Active bookings already held on `date`, any unit. */
  taken: readonly ActiveBooking[];
  unit: UnitState;
};

export function checkBooking(request: BookingRequest): BookingCheck {
  const { date, slotIndex, courtNo, now, limits, closures, taken, unit } =
    request;

  if (!isValidSlotIndex(slotIndex)) {
    return reject('invalid_slot', 'That time slot does not exist.');
  }

  const sport = sportForDate(date);
  if (!isValidCourtNo(sport, courtNo)) {
    return reject('invalid_court', 'That court is not available on this day.');
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

  if (unit.isBlocked) {
    return reject(
      'unit_blocked',
      'This unit cannot book right now. Please contact the association office.',
    );
  }

  const closure = findClosure(closures, date, slotIndex, courtNo);
  if (closure) {
    return reject('closed', `Court closed — ${closure.reason}.`);
  }

  if (limits.enabled) {
    const usage = unitUsage(unit, date, limits);
    if (usage.dayUsed >= usage.dayMax) {
      return reject(
        'day_limit',
        `This unit already has a booking on ${formatShortDate(date)}.`,
      );
    }
    if (usage.weekUsed >= usage.weekMax) {
      return reject(
        'week_limit',
        `This unit has used all ${usage.weekMax} bookings for that week.`,
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

  return OK;
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
  courts: CourtAvailability[];
  openCount: number;
};

export type DayAvailability = {
  date: DateStr;
  sport: Sport;
  slots: SlotAvailability[];
  openCount: number;
  capacity: number;
  /** False when the date is outside the booking window entirely. */
  withinWindow: boolean;
};

export type AvailabilityRequest = {
  date: DateStr;
  now: ManilaMoment;
  limits: BookingLimits;
  closures: readonly Closure[];
  taken: readonly ActiveBooking[];
};

export function computeDayAvailability(
  request: AvailabilityRequest,
): DayAvailability {
  const { date, now, limits, closures, taken } = request;
  const sport = sportForDate(date);
  const courts = courtNumbers(sport);

  const takenKeys = new Set(
    taken
      .filter((booking) => booking.date === date)
      .map((booking) => `${booking.slotIndex}:${booking.courtNo}`),
  );

  let openCount = 0;
  const slots = SLOTS.map((slot) => {
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

    const slotOpen = courtStates.filter((c) => c.status === 'open').length;
    openCount += slotOpen;

    return {
      slotIndex: slot.index,
      label: slot.label,
      startMinutes: slot.startMinutes,
      courts: courtStates,
      openCount: slotOpen,
    };
  });

  const daysAhead = daysBetween(now.date, date);
  const withinWindow =
    daysAhead >= 0 && (!limits.enabled || daysAhead <= limits.advanceDays);

  return {
    date,
    sport,
    slots,
    openCount,
    capacity: dailyCapacity(date),
    withinWindow,
  };
}

/** The dates a resident may choose from, starting today. */
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
