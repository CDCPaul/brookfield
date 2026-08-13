/**
 * Date and time helpers, all anchored to Asia/Manila.
 *
 * The Philippines is UTC+8 year-round and has observed no DST since 1978, so a
 * fixed offset is safe here and keeps every function pure and testable. Civil
 * dates are passed around as 'YYYY-MM-DD' strings rather than Date objects so
 * that nothing accidentally shifts a booking across midnight.
 */

export const MANILA_UTC_OFFSET_MINUTES = 8 * 60;

const MS_PER_DAY = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A civil date in Manila, formatted 'YYYY-MM-DD'. */
export type DateStr = string;

export function isValidDateStr(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Reject dates like 2026-02-30 that pass the range check but do not exist.
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

function assertDateStr(value: string): void {
  if (!isValidDateStr(value)) {
    throw new RangeError(`Invalid date string: ${JSON.stringify(value)}`);
  }
}

export function toEpochDay(date: DateStr): number {
  assertDateStr(date);
  const [, y, m, d] = DATE_PATTERN.exec(date)!;
  return Date.UTC(Number(y), Number(m) - 1, Number(d)) / MS_PER_DAY;
}

export function fromEpochDay(epochDay: number): DateStr {
  const utc = new Date(epochDay * MS_PER_DAY);
  const y = String(utc.getUTCFullYear()).padStart(4, '0');
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: DateStr, days: number): DateStr {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: DateStr, to: DateStr): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(date: DateStr): number {
  return new Date(toEpochDay(date) * MS_PER_DAY).getUTCDay();
}

/** Monday of the week containing `date`. Weeks run Monday through Sunday. */
export function weekStart(date: DateStr): DateStr {
  const dow = dayOfWeek(date);
  const daysSinceMonday = (dow + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

export function isSameWeek(a: DateStr, b: DateStr): boolean {
  return weekStart(a) === weekStart(b);
}

export type ManilaMoment = {
  /** Civil date in Manila. */
  date: DateStr;
  /** Minutes elapsed since Manila midnight, 0–1439. */
  minutes: number;
};

/** Converts an absolute instant into the Manila wall clock. */
export function manilaNow(now: Date = new Date()): ManilaMoment {
  const shifted = new Date(now.getTime() + MANILA_UTC_OFFSET_MINUTES * 60_000);
  const y = String(shifted.getUTCFullYear()).padStart(4, '0');
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return {
    date: `${y}-${m}-${d}`,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** Formats minutes-since-midnight as 'H:MM AM/PM' for display. */
export function formatClock(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function weekdayName(date: DateStr): string {
  return WEEKDAY_NAMES[dayOfWeek(date)];
}

export function weekdayShort(date: DateStr): string {
  return WEEKDAY_NAMES[dayOfWeek(date)].slice(0, 3);
}

/** e.g. '2026-08-13' -> 'Aug 13'. */
export function formatShortDate(date: DateStr): string {
  const [, , m, d] = DATE_PATTERN.exec(date)!;
  return `${MONTH_NAMES[Number(m) - 1]} ${Number(d)}`;
}

/** e.g. '2026-08-13' -> 'Thursday, Aug 13'. */
export function formatLongDate(date: DateStr): string {
  return `${weekdayName(date)}, ${formatShortDate(date)}`;
}

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export function isValidMonthStr(value: string): boolean {
  const match = MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/** First and last day of a 'YYYY-MM' month, inclusive. */
export function monthRange(month: string): { from: DateStr; to: DateStr } {
  if (!isValidMonthStr(month)) {
    throw new RangeError(`Invalid month string: ${JSON.stringify(month)}`);
  }
  const [, y, m] = MONTH_PATTERN.exec(month)!;
  const year = Number(y);
  const monthNumber = Number(m);
  const from = `${y}-${m}-01`;
  const nextMonthStart =
    monthNumber === 12
      ? `${year + 1}-01-01`
      : `${y}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(nextMonthStart, -1) };
}

/** The 'YYYY-MM' a date belongs to. */
export function monthOf(date: DateStr): string {
  const [, y, m] = DATE_PATTERN.exec(date)!;
  return `${y}-${m}`;
}

export function formatMonth(month: string): string {
  const [, y, m] = MONTH_PATTERN.exec(month)!;
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}
