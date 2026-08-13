/**
 * Which sport runs on which day, how the day is sliced, and what each slice
 * costs.
 *
 * Tennis and pickleball share one physical space at Brookfield, so the two
 * sports never overlap: the day of the week decides which one is set up.
 *
 * The courts open at 06:00 and the first three hours are free for residents.
 * Everything after that is paid. The slot grid itself is fixed — one slot per
 * hour from 06:00 to midnight — while the association can move the boundaries
 * between free, daytime and evening, and can close the courts earlier.
 */

import { type DateStr, dayOfWeek, formatClock } from './time';

export type Sport = 'tennis' | 'pickleball';

/** What a slot costs, and to whom it is open. */
export type Tier = 'free' | 'day' | 'night';

export type Slot = {
  index: number;
  startHour: number;
  /** Minutes since midnight. */
  startMinutes: number;
  endMinutes: number;
  label: string;
};

/** The courts never open before this hour. Slot 0 starts here. */
export const OPEN_HOUR = 6;
/** One slot per hour through to midnight. */
export const LAST_HOUR = 24;

export const SLOTS: readonly Slot[] = Array.from(
  { length: LAST_HOUR - OPEN_HOUR },
  (_, index) => {
    const startHour = OPEN_HOUR + index;
    return {
      index,
      startHour,
      startMinutes: startHour * 60,
      endMinutes: (startHour + 1) * 60,
      label: `${formatClock(startHour * 60)} – ${formatClock((startHour + 1) * 60)}`,
    };
  },
);

export const SLOT_COUNT = SLOTS.length;

export function isValidSlotIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < SLOT_COUNT;
}

export function getSlot(index: number): Slot {
  if (!isValidSlotIndex(index)) {
    throw new RangeError(`Invalid slot index: ${index}`);
  }
  return SLOTS[index];
}

/**
 * Hour boundaries the association controls.
 *
 * `freeUntilHour` ends the free morning; `dayUntilHour` ends daytime pricing;
 * `closeHour` is when the courts shut. Slots at or after `closeHour` are not
 * offered at all.
 */
export type ScheduleConfig = {
  freeUntilHour: number;
  dayUntilHour: number;
  closeHour: number;
};

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  freeUntilHour: 9,
  dayUntilHour: 18,
  closeHour: 24,
};

export type Pricing = Record<Exclude<Tier, 'free'>, Record<Sport, number>>;

/**
 * Pesos per one-hour slot.
 *
 * Pickleball matches the published BrookSide Bounce rate card. Tennis has no
 * published rate yet — these are placeholders for the association to set.
 */
export const DEFAULT_PRICING: Pricing = {
  day: { pickleball: 200, tennis: 350 },
  night: { pickleball: 350, tennis: 400 },
};

/** The tier a slot falls into, or null when the courts are closed. */
export function tierForSlot(
  index: number,
  schedule: ScheduleConfig,
): Tier | null {
  if (!isValidSlotIndex(index)) return null;
  const { startHour } = SLOTS[index];

  if (startHour >= schedule.closeHour) return null;
  if (startHour < schedule.freeUntilHour) return 'free';
  if (startHour < schedule.dayUntilHour) return 'day';
  return 'night';
}

export function priceFor(
  tier: Tier,
  sport: Sport,
  pricing: Pricing,
): number {
  return tier === 'free' ? 0 : pricing[tier][sport];
}

/** Slots that are open at all, in order. */
export function openSlots(schedule: ScheduleConfig): Slot[] {
  return SLOTS.filter((slot) => tierForSlot(slot.index, schedule) !== null);
}

export function slotsInTier(schedule: ScheduleConfig, tier: Tier): Slot[] {
  return SLOTS.filter((slot) => tierForSlot(slot.index, schedule) === tier);
}

// 0 = Sunday ... 6 = Saturday.
const SPORT_BY_WEEKDAY: readonly Sport[] = [
  'tennis', // Sunday
  'tennis', // Monday
  'pickleball', // Tuesday
  'tennis', // Wednesday
  'pickleball', // Thursday
  'tennis', // Friday
  'pickleball', // Saturday
];

export function sportForDate(date: DateStr): Sport {
  return SPORT_BY_WEEKDAY[dayOfWeek(date)];
}

const COURT_COUNT: Record<Sport, number> = {
  tennis: 1,
  pickleball: 4,
};

export function courtCount(sport: Sport): number {
  return COURT_COUNT[sport];
}

export function courtNumbers(sport: Sport): number[] {
  return Array.from({ length: COURT_COUNT[sport] }, (_, i) => i + 1);
}

export function isValidCourtNo(sport: Sport, courtNo: number): boolean {
  return (
    Number.isInteger(courtNo) && courtNo >= 1 && courtNo <= COURT_COUNT[sport]
  );
}

/** Total bookable places on a given date, across every open hour. */
export function dailyCapacity(
  date: DateStr,
  schedule: ScheduleConfig,
): number {
  return courtCount(sportForDate(date)) * openSlots(schedule).length;
}

const SPORT_LABELS: Record<Sport, string> = {
  tennis: 'Tennis',
  pickleball: 'Pickleball',
};

export function sportLabel(sport: Sport): string {
  return SPORT_LABELS[sport];
}

const TIER_LABELS: Record<Tier, string> = {
  free: 'Free morning',
  day: 'Daytime',
  night: 'Evening',
};

export function tierLabel(tier: Tier): string {
  return TIER_LABELS[tier];
}

/** The hour range covered by a tier, for headings like '9:00 AM – 6:00 PM'. */
export function tierRangeLabel(
  tier: Tier,
  schedule: ScheduleConfig,
): string {
  const bounds: Record<Tier, [number, number]> = {
    free: [OPEN_HOUR, schedule.freeUntilHour],
    day: [schedule.freeUntilHour, schedule.dayUntilHour],
    night: [schedule.dayUntilHour, schedule.closeHour],
  };
  const [from, to] = bounds[tier];
  return `${formatClock(from * 60)} – ${formatClock(to * 60)}`;
}

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH')}`;
}
