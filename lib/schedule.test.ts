import { describe, expect, it } from 'vitest';

import {
  SLOTS,
  SLOT_COUNT,
  courtCount,
  courtNumbers,
  dailyCapacity,
  getSlot,
  isValidCourtNo,
  isValidSlotIndex,
  sportForDate,
} from './schedule';

describe('slots', () => {
  it('splits 6-9 AM into three one-hour slots', () => {
    expect(SLOT_COUNT).toBe(3);
    expect(SLOTS.map((s) => s.startMinutes)).toEqual([360, 420, 480]);
    expect(SLOTS[0].label).toBe('6:00 AM – 7:00 AM');
    expect(SLOTS[2].label).toBe('8:00 AM – 9:00 AM');
  });

  it('validates slot indexes', () => {
    expect(isValidSlotIndex(0)).toBe(true);
    expect(isValidSlotIndex(2)).toBe(true);
    expect(isValidSlotIndex(3)).toBe(false);
    expect(isValidSlotIndex(-1)).toBe(false);
    expect(isValidSlotIndex(1.5)).toBe(false);
    expect(() => getSlot(3)).toThrow(RangeError);
  });
});

describe('sportForDate', () => {
  // Week of 2026-08-10 (Monday) through 2026-08-16 (Sunday).
  it('runs tennis on Mon, Wed, Fri and Sun', () => {
    expect(sportForDate('2026-08-10')).toBe('tennis'); // Monday
    expect(sportForDate('2026-08-12')).toBe('tennis'); // Wednesday
    expect(sportForDate('2026-08-14')).toBe('tennis'); // Friday
    expect(sportForDate('2026-08-16')).toBe('tennis'); // Sunday
  });

  it('runs pickleball on Tue, Thu and Sat', () => {
    expect(sportForDate('2026-08-11')).toBe('pickleball'); // Tuesday
    expect(sportForDate('2026-08-13')).toBe('pickleball'); // Thursday
    expect(sportForDate('2026-08-15')).toBe('pickleball'); // Saturday
  });

  it('covers every day of the week', () => {
    const week = [
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ];
    expect(week.every((d) => sportForDate(d) !== undefined)).toBe(true);
  });
});

describe('courts', () => {
  it('has one tennis court and four pickleball courts', () => {
    expect(courtCount('tennis')).toBe(1);
    expect(courtCount('pickleball')).toBe(4);
    expect(courtNumbers('tennis')).toEqual([1]);
    expect(courtNumbers('pickleball')).toEqual([1, 2, 3, 4]);
  });

  it('rejects court numbers outside the sport range', () => {
    expect(isValidCourtNo('tennis', 1)).toBe(true);
    expect(isValidCourtNo('tennis', 2)).toBe(false);
    expect(isValidCourtNo('pickleball', 4)).toBe(true);
    expect(isValidCourtNo('pickleball', 5)).toBe(false);
    expect(isValidCourtNo('pickleball', 0)).toBe(false);
  });

  it('computes daily capacity from sport and slots', () => {
    expect(dailyCapacity('2026-08-10')).toBe(3); // tennis: 1 court x 3 slots
    expect(dailyCapacity('2026-08-13')).toBe(12); // pickleball: 4 x 3
  });
});
