/**
 * Booking eligibility and availability, as pure functions.
 *
 * Everything the server needs to accept or reject a booking lives here, with no
 * database access, so the rules can be tested exhaustively. The database still
 * has the final say on double-booking, through a unique index on the physical
 * resources a booking occupies; this module decides everything else, works out
 * what the slot costs, and produces the message the booker sees.
 */

import {
  type CourtConfig,
  type CourtOption,
  type ResourceKey,
  type Venue,
  findOption,
  optionsFor,
  priceForOption,
} from './courts';
import type { BookerType } from './owner';
import {
  type Pricing,
  type ScheduleConfig,
  type Slot,
  type Tier,
  getSlot,
  isValidSlotIndex,
  openSlots,
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
  /** null closes both surfaces. */
  venue: Venue | null;
  reason: string;
};

/** One resource held for one slot, by anyone. */
export type HeldResource = {
  date: DateStr;
  slotIndex: number;
  resourceKey: ResourceKey;
  /** Which option holds it, so the UI can say why something is blocked. */
  optionKey: string;
};

export type BookerState = {
  isBlocked: boolean;
  /** Active bookings they hold. Only free ones count against the limits. */
  bookings: { date: DateStr; isFree: boolean }[];
};

export const EMPTY_BOOKER: BookerState = { isBlocked: false, bookings: [] };

export type RejectionCode =
  | 'invalid_slot'
  | 'invalid_option'
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
  | { ok: true; tier: Tier; price: number; option: CourtOption }
  | { ok: false; code: RejectionCode; message: string };

function reject(code: RejectionCode, message: string): BookingCheck {
  return { ok: false, code, message };
}

export function findClosure(
  closures: readonly Closure[],
  date: DateStr,
  slotIndex: number,
  venue: Venue,
): Closure | null {
  for (const closure of closures) {
    const withinRange =
      daysBetween(closure.dateFrom, date) >= 0 &&
      daysBetween(date, closure.dateTo) >= 0;
    if (!withinRange) continue;
    if (closure.slotIndex !== null && closure.slotIndex !== slotIndex) continue;
    if (closure.venue !== null && closure.venue !== venue) continue;
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
    if (!booking.isFree) continue;
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
  optionKey: string;
  bookerType: BookerType;
  now: ManilaMoment;
  limits: BookingLimits;
  schedule: ScheduleConfig;
  pricing: Pricing;
  courts: CourtConfig;
  closures: readonly Closure[];
  /** Resources already held on `date`, by anyone. */
  held: readonly HeldResource[];
  booker: BookerState;
};

export function checkBooking(request: BookingRequest): BookingCheck {
  const {
    date,
    slotIndex,
    optionKey,
    bookerType,
    now,
    limits,
    schedule,
    pricing,
    courts,
    closures,
    held,
    booker,
  } = request;

  if (!isValidSlotIndex(slotIndex)) {
    return reject('invalid_slot', 'That time slot does not exist.');
  }

  const tier = tierForSlot(slotIndex, schedule);
  if (tier === null) {
    return reject('closed_hours', 'The courts are closed at that hour.');
  }

  const option = findOption(optionKey);
  if (!option) {
    return reject('invalid_option', 'That court does not exist.');
  }

  const offered = optionsFor(date, tier, courts);
  if (!offered.some((entry) => entry.key === option.key)) {
    return reject('invalid_option', 'That court is not available at that time.');
  }

  const price = priceForOption(option, tier, pricing);

  // The benefit residents get is the free court time, so that — and only that
  // — is what guests cannot take. Paid hours are open to everyone, including
  // the basketball court during the free morning.
  if (price === 0 && bookerType === 'guest') {
    return reject(
      'guest_free_hours',
      'The free morning hours are for Brookfield residents. Guests can book ' +
        `paid hours from ${formatHour(schedule.freeUntilHour)}, or the ` +
        'basketball court at any time.',
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

  const closure = findClosure(closures, date, slotIndex, option.venue);
  if (closure) {
    return reject('closed', `Court closed — ${closure.reason}.`);
  }

  // Limits guard free court time only — never anything paid for.
  if (limits.enabled && price === 0) {
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

  const blocker = findBlocker(held, date, slotIndex, option);
  if (blocker) {
    return reject('taken', `${describeBlocker(blocker)} Please pick another.`);
  }

  return { ok: true, tier, price, option };
}

/** The first held resource that overlaps this option, if any. */
export function findBlocker(
  held: readonly HeldResource[],
  date: DateStr,
  slotIndex: number,
  option: CourtOption,
): HeldResource | null {
  for (const entry of held) {
    if (entry.date !== date || entry.slotIndex !== slotIndex) continue;
    if (option.resources.includes(entry.resourceKey)) return entry;
  }
  return null;
}

/** Plain-language reason a court is unavailable, naming what is in the way. */
export function describeBlocker(blocker: HeldResource): string {
  const holder = findOption(blocker.optionKey);
  if (!holder) return 'This court is already booked.';
  return `${holder.label} is booked this hour.`;
}

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00 ${suffix}`;
}

export type OptionStatus = 'open' | 'taken' | 'closed' | 'past';

export type OptionAvailability = {
  option: CourtOption;
  status: OptionStatus;
  price: number;
  /** Why it is unavailable, when it is. */
  reason?: string;
};

export type SlotAvailability = {
  slotIndex: number;
  label: string;
  startMinutes: number;
  tier: Tier;
  options: OptionAvailability[];
  openCount: number;
};

export type TierGroup = {
  tier: Tier;
  label: string;
  rangeLabel: string;
  slots: SlotAvailability[];
  openCount: number;
  capacity: number;
};

export type DayAvailability = {
  date: DateStr;
  groups: TierGroup[];
  openCount: number;
  capacity: number;
  withinWindow: boolean;
};

export type AvailabilityRequest = {
  date: DateStr;
  now: ManilaMoment;
  limits: BookingLimits;
  schedule: ScheduleConfig;
  pricing: Pricing;
  courts: CourtConfig;
  closures: readonly Closure[];
  held: readonly HeldResource[];
  /** Restrict to one activity, for the sport tabs. */
  activity?: CourtOption['activity'];
};

const TIER_ORDER: Tier[] = ['free', 'day', 'night'];

export function computeDayAvailability(
  request: AvailabilityRequest,
): DayAvailability {
  const {
    date,
    now,
    limits,
    schedule,
    pricing,
    courts,
    closures,
    held,
    activity,
  } = request;

  const slots: SlotAvailability[] = [];

  for (const slot of openSlots(schedule)) {
    const tier = tierForSlot(slot.index, schedule)!;
    const past = isPastSlot(date, slot, now);

    const offered = optionsFor(date, tier, courts).filter(
      (option) => !activity || option.activity === activity,
    );
    if (offered.length === 0) continue;

    const options = offered.map<OptionAvailability>((option) => {
      const price = priceForOption(option, tier, pricing);
      if (past) return { option, status: 'past', price };

      const closure = findClosure(closures, date, slot.index, option.venue);
      if (closure) {
        return { option, status: 'closed', price, reason: closure.reason };
      }

      const blocker = findBlocker(held, date, slot.index, option);
      if (blocker) {
        return {
          option,
          status: 'taken',
          price,
          reason: describeBlocker(blocker),
        };
      }

      return { option, status: 'open', price };
    });

    slots.push({
      slotIndex: slot.index,
      label: slot.label,
      startMinutes: slot.startMinutes,
      tier,
      options,
      openCount: options.filter((entry) => entry.status === 'open').length,
    });
  }

  const groups: TierGroup[] = [];
  for (const tier of TIER_ORDER) {
    const inTier = slots.filter((slot) => slot.tier === tier);
    if (inTier.length === 0) continue;

    // 'Free morning' is only honest when something in the block is free —
    // basketball is charged in those hours.
    const anyFree = inTier.some((slot) =>
      slot.options.some((option) => option.price === 0),
    );

    groups.push({
      tier,
      label: tier === 'free' && !anyFree ? 'Early morning' : tierLabel(tier),
      rangeLabel: tierRangeLabel(tier, schedule),
      slots: inTier,
      openCount: inTier.reduce((total, slot) => total + slot.openCount, 0),
      capacity: inTier.reduce((total, slot) => total + slot.options.length, 0),
    });
  }

  const daysAhead = daysBetween(now.date, date);

  return {
    date,
    groups,
    openCount: groups.reduce((total, group) => total + group.openCount, 0),
    capacity: groups.reduce((total, group) => total + group.capacity, 0),
    withinWindow:
      daysAhead >= 0 && (!limits.enabled || daysAhead <= limits.advanceDays),
  };
}

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
