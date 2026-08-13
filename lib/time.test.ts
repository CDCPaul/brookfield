import { describe, expect, it } from 'vitest';

import {
  addDays,
  dayOfWeek,
  daysBetween,
  formatClock,
  formatLongDate,
  formatMonth,
  fromEpochDay,
  isSameWeek,
  isValidDateStr,
  isValidMonthStr,
  manilaNow,
  monthOf,
  monthRange,
  weekStart,
} from './time';

describe('isValidDateStr', () => {
  it('accepts real dates', () => {
    expect(isValidDateStr('2026-08-13')).toBe(true);
    expect(isValidDateStr('2028-02-29')).toBe(true);
  });

  it('rejects malformed or impossible dates', () => {
    expect(isValidDateStr('2026-02-30')).toBe(false);
    expect(isValidDateStr('2026-13-01')).toBe(false);
    expect(isValidDateStr('2026-8-13')).toBe(false);
    expect(isValidDateStr('not-a-date')).toBe(false);
    expect(isValidDateStr('')).toBe(false);
  });
});

describe('date arithmetic', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('measures signed day distance', () => {
    expect(daysBetween('2026-08-13', '2026-08-20')).toBe(7);
    expect(daysBetween('2026-08-20', '2026-08-13')).toBe(-7);
    expect(daysBetween('2026-08-13', '2026-08-13')).toBe(0);
  });

  it('round-trips through epoch days', () => {
    expect(fromEpochDay(0)).toBe('1970-01-01');
  });

  it('throws on invalid input rather than guessing', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
  });
});

describe('weekday handling', () => {
  it('reports the correct weekday', () => {
    // 2026-08-13 is a Thursday.
    expect(dayOfWeek('2026-08-13')).toBe(4);
    expect(dayOfWeek('2026-08-16')).toBe(0); // Sunday
    expect(dayOfWeek('2026-08-10')).toBe(1); // Monday
  });

  it('starts weeks on Monday', () => {
    expect(weekStart('2026-08-13')).toBe('2026-08-10'); // Thu -> Mon
    expect(weekStart('2026-08-10')).toBe('2026-08-10'); // Mon -> itself
    expect(weekStart('2026-08-16')).toBe('2026-08-10'); // Sun -> same week
    expect(weekStart('2026-08-17')).toBe('2026-08-17'); // next Mon
  });

  it('treats Sunday as the end of the week, not the start', () => {
    expect(isSameWeek('2026-08-16', '2026-08-10')).toBe(true);
    expect(isSameWeek('2026-08-16', '2026-08-17')).toBe(false);
  });
});

describe('manilaNow', () => {
  it('shifts UTC forward by eight hours', () => {
    const moment = manilaNow(new Date('2026-08-13T02:15:00Z'));
    expect(moment.date).toBe('2026-08-13');
    expect(moment.minutes).toBe(10 * 60 + 15);
  });

  it('rolls over to the next Manila day late in the UTC day', () => {
    const moment = manilaNow(new Date('2026-08-13T16:30:00Z'));
    expect(moment.date).toBe('2026-08-14');
    expect(moment.minutes).toBe(30);
  });

  it('stays on the same Manila day just before rollover', () => {
    const moment = manilaNow(new Date('2026-08-13T15:59:00Z'));
    expect(moment.date).toBe('2026-08-13');
    expect(moment.minutes).toBe(23 * 60 + 59);
  });
});

describe('formatting', () => {
  it('formats clock times in 12-hour form', () => {
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(360)).toBe('6:00 AM');
    expect(formatClock(720)).toBe('12:00 PM');
    expect(formatClock(1305)).toBe('9:45 PM');
  });

  it('formats dates for display', () => {
    expect(formatLongDate('2026-08-13')).toBe('Thursday, Aug 13');
  });
});

describe('month ranges', () => {
  it('spans a full month inclusively', () => {
    expect(monthRange('2026-08')).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(monthRange('2026-02')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(monthRange('2028-02').to).toBe('2028-02-29'); // leap year
  });

  it('rolls over the year in December', () => {
    expect(monthRange('2026-12')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });

  it('rejects invalid months', () => {
    expect(isValidMonthStr('2026-13')).toBe(false);
    expect(isValidMonthStr('2026-00')).toBe(false);
    expect(isValidMonthStr('2026-8')).toBe(false);
    expect(() => monthRange('2026-13')).toThrow(RangeError);
  });

  it('reads the month from a date', () => {
    expect(monthOf('2026-08-13')).toBe('2026-08');
    expect(formatMonth('2026-08')).toBe('Aug 2026');
  });
});
