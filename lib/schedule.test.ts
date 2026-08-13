import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRICING,
  DEFAULT_SCHEDULE,
  OPEN_HOUR,
  SLOTS,
  SLOT_COUNT,
  courtCount,
  courtNumbers,
  dailyCapacity,
  formatPeso,
  getSlot,
  isValidCourtNo,
  isValidSlotIndex,
  openSlots,
  priceFor,
  slotsInTier,
  sportForDate,
  tierForSlot,
  tierRangeLabel,
} from './schedule';

describe('slots', () => {
  it('covers every hour from 6 AM to midnight', () => {
    expect(SLOT_COUNT).toBe(18);
    expect(SLOTS[0].startHour).toBe(OPEN_HOUR);
    expect(SLOTS[0].label).toBe('6:00 AM – 7:00 AM');
    expect(SLOTS.at(-1)?.startHour).toBe(23);
    expect(SLOTS.at(-1)?.label).toBe('11:00 PM – 12:00 AM');
  });

  it('maps index to hour as 6 + index', () => {
    expect(getSlot(0).startHour).toBe(6);
    expect(getSlot(3).startHour).toBe(9);
    expect(getSlot(12).startHour).toBe(18);
  });

  it('validates slot indexes', () => {
    expect(isValidSlotIndex(0)).toBe(true);
    expect(isValidSlotIndex(17)).toBe(true);
    expect(isValidSlotIndex(18)).toBe(false);
    expect(isValidSlotIndex(-1)).toBe(false);
    expect(isValidSlotIndex(1.5)).toBe(false);
    expect(() => getSlot(18)).toThrow(RangeError);
  });
});

describe('tiers', () => {
  it('splits the day into free, daytime and evening', () => {
    expect(tierForSlot(0, DEFAULT_SCHEDULE)).toBe('free'); // 06:00
    expect(tierForSlot(2, DEFAULT_SCHEDULE)).toBe('free'); // 08:00
    expect(tierForSlot(3, DEFAULT_SCHEDULE)).toBe('day'); // 09:00
    expect(tierForSlot(11, DEFAULT_SCHEDULE)).toBe('day'); // 17:00
    expect(tierForSlot(12, DEFAULT_SCHEDULE)).toBe('night'); // 18:00
    expect(tierForSlot(17, DEFAULT_SCHEDULE)).toBe('night'); // 23:00
  });

  it('returns null once the courts close', () => {
    const early = { ...DEFAULT_SCHEDULE, closeHour: 21 };
    expect(tierForSlot(14, early)).toBe('night'); // 20:00
    expect(tierForSlot(15, early)).toBeNull(); // 21:00
    expect(tierForSlot(99, DEFAULT_SCHEDULE)).toBeNull();
  });

  it('follows the boundaries the association sets', () => {
    const shifted = { freeUntilHour: 8, dayUntilHour: 16, closeHour: 22 };
    expect(tierForSlot(1, shifted)).toBe('free'); // 07:00
    expect(tierForSlot(2, shifted)).toBe('day'); // 08:00
    expect(tierForSlot(9, shifted)).toBe('day'); // 15:00
    expect(tierForSlot(10, shifted)).toBe('night'); // 16:00
    expect(tierForSlot(16, shifted)).toBeNull(); // 22:00
  });

  it('lists the slots in each tier', () => {
    expect(slotsInTier(DEFAULT_SCHEDULE, 'free')).toHaveLength(3);
    expect(slotsInTier(DEFAULT_SCHEDULE, 'day')).toHaveLength(9);
    expect(slotsInTier(DEFAULT_SCHEDULE, 'night')).toHaveLength(6);
    expect(openSlots(DEFAULT_SCHEDULE)).toHaveLength(18);
  });

  it('describes each tier range for headings', () => {
    expect(tierRangeLabel('free', DEFAULT_SCHEDULE)).toBe('6:00 AM – 9:00 AM');
    expect(tierRangeLabel('day', DEFAULT_SCHEDULE)).toBe('9:00 AM – 6:00 PM');
    expect(tierRangeLabel('night', DEFAULT_SCHEDULE)).toBe('6:00 PM – 12:00 AM');
  });
});

describe('pricing', () => {
  it('charges nothing for the free morning', () => {
    expect(priceFor('free', 'tennis', DEFAULT_PRICING)).toBe(0);
    expect(priceFor('free', 'pickleball', DEFAULT_PRICING)).toBe(0);
  });

  it('charges per sport and tier', () => {
    expect(priceFor('day', 'pickleball', DEFAULT_PRICING)).toBe(200);
    expect(priceFor('day', 'tennis', DEFAULT_PRICING)).toBe(350);
    expect(priceFor('night', 'pickleball', DEFAULT_PRICING)).toBe(350);
    expect(priceFor('night', 'tennis', DEFAULT_PRICING)).toBe(400);
  });

  it('formats pesos', () => {
    expect(formatPeso(200)).toBe('₱200');
    expect(formatPeso(1200)).toBe('₱1,200');
  });
});

describe('sportForDate', () => {
  // Week of 2026-08-10 (Monday) through 2026-08-16 (Sunday).
  it('runs tennis on Mon, Wed, Fri and Sun', () => {
    expect(sportForDate('2026-08-10')).toBe('tennis');
    expect(sportForDate('2026-08-12')).toBe('tennis');
    expect(sportForDate('2026-08-14')).toBe('tennis');
    expect(sportForDate('2026-08-16')).toBe('tennis');
  });

  it('runs pickleball on Tue, Thu and Sat', () => {
    expect(sportForDate('2026-08-11')).toBe('pickleball');
    expect(sportForDate('2026-08-13')).toBe('pickleball');
    expect(sportForDate('2026-08-15')).toBe('pickleball');
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

  it('computes daily capacity from sport, slots and closing time', () => {
    expect(dailyCapacity('2026-08-10', DEFAULT_SCHEDULE)).toBe(18);
    expect(dailyCapacity('2026-08-13', DEFAULT_SCHEDULE)).toBe(72);
    expect(
      dailyCapacity('2026-08-10', { ...DEFAULT_SCHEDULE, closeHour: 20 }),
    ).toBe(14);
  });
});
