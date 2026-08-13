/**
 * Which sport runs on which day, and how the free morning window is sliced.
 *
 * Tennis and pickleball share one physical space at Brookfield, so the two
 * sports never overlap: the day of the week decides which one is set up.
 */

import { type DateStr, dayOfWeek, formatClock } from './time';

export type Sport = 'tennis' | 'pickleball';

export type Slot = {
  index: number;
  /** Minutes since midnight, Manila time. */
  startMinutes: number;
  endMinutes: number;
  label: string;
};

const SLOT_START_HOURS = [6, 7, 8];

export const SLOTS: readonly Slot[] = SLOT_START_HOURS.map((hour, index) => ({
  index,
  startMinutes: hour * 60,
  endMinutes: (hour + 1) * 60,
  label: `${formatClock(hour * 60)} – ${formatClock((hour + 1) * 60)}`,
}));

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

/** Total bookable places on a given date. */
export function dailyCapacity(date: DateStr): number {
  return courtCount(sportForDate(date)) * SLOT_COUNT;
}

const SPORT_LABELS: Record<Sport, string> = {
  tennis: 'Tennis',
  pickleball: 'Pickleball',
};

export function sportLabel(sport: Sport): string {
  return SPORT_LABELS[sport];
}
