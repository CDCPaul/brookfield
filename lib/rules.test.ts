import { describe, expect, it } from 'vitest';

import {
  type BookingLimits,
  type BookingRequest,
  type BookerState,
  type Closure,
  DEFAULT_LIMITS,
  EMPTY_BOOKER,
  bookableDates,
  bookerUsage,
  checkBooking,
  computeDayAvailability,
  findClosure,
  findSlotAvailability,
  isPastSlot,
} from './rules';
import {
  DEFAULT_PRICING,
  DEFAULT_SCHEDULE,
  type Tier,
  getSlot,
} from './schedule';
import type { ManilaMoment } from './time';

// 2026-08-13 is a Thursday (pickleball, 4 courts).
// 2026-08-14 is a Friday (tennis, 1 court).
// The week runs Mon 2026-08-10 through Sun 2026-08-16.
//
// Slot index n starts at hour 6 + n, so:
//   0–2   free      (06:00–09:00)
//   3–11  daytime   (09:00–18:00)
//   12–17 evening   (18:00–24:00)
const NOW: ManilaMoment = { date: '2026-08-13', minutes: 5 * 60 };

const FREE_SLOT = 0;
const DAY_SLOT = 4; // 10:00
const NIGHT_SLOT = 13; // 19:00

function held(date: string, tier: Tier = 'free') {
  return { date, tier };
}

function booker(overrides: Partial<BookerState> = {}): BookerState {
  return { ...EMPTY_BOOKER, ...overrides };
}

function request(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    date: '2026-08-14',
    slotIndex: FREE_SLOT,
    courtNo: 1,
    bookerType: 'resident',
    now: NOW,
    limits: DEFAULT_LIMITS,
    schedule: DEFAULT_SCHEDULE,
    pricing: DEFAULT_PRICING,
    closures: [],
    taken: [],
    booker: EMPTY_BOOKER,
    ...overrides,
  };
}

describe('isPastSlot', () => {
  it('blocks a slot once its start time is reached', () => {
    const sevenAm: ManilaMoment = { date: '2026-08-13', minutes: 7 * 60 };
    expect(isPastSlot('2026-08-13', getSlot(1), sevenAm)).toBe(true);
    expect(isPastSlot('2026-08-13', getSlot(2), sevenAm)).toBe(false);
  });

  it('allows booking right up to the minute before start', () => {
    const justBefore: ManilaMoment = { date: '2026-08-13', minutes: 7 * 60 - 1 };
    expect(isPastSlot('2026-08-13', getSlot(1), justBefore)).toBe(false);
  });

  it('treats earlier dates as past and later dates as open', () => {
    expect(isPastSlot('2026-08-12', getSlot(2), NOW)).toBe(true);
    expect(isPastSlot('2026-08-14', getSlot(0), NOW)).toBe(false);
  });
});

describe('checkBooking', () => {
  it('accepts a free morning booking at no charge', () => {
    expect(checkBooking(request())).toEqual({
      ok: true,
      tier: 'free',
      price: 0,
    });
  });

  it('prices daytime and evening slots by sport', () => {
    // Friday is tennis.
    expect(checkBooking(request({ slotIndex: DAY_SLOT }))).toEqual({
      ok: true,
      tier: 'day',
      price: 350,
    });
    expect(checkBooking(request({ slotIndex: NIGHT_SLOT }))).toEqual({
      ok: true,
      tier: 'night',
      price: 400,
    });

    // Thursday 2026-08-20 is pickleball.
    expect(
      checkBooking(request({ date: '2026-08-20', slotIndex: DAY_SLOT })),
    ).toEqual({ ok: true, tier: 'day', price: 200 });
    expect(
      checkBooking(request({ date: '2026-08-20', slotIndex: NIGHT_SLOT })),
    ).toEqual({ ok: true, tier: 'night', price: 350 });
  });

  it('applies the tier boundaries exactly', () => {
    // 08:00 is the last free hour; 09:00 is the first paid one.
    expect(checkBooking(request({ slotIndex: 2 }))).toMatchObject({
      tier: 'free',
    });
    expect(checkBooking(request({ slotIndex: 3 }))).toMatchObject({
      tier: 'day',
    });
    // 17:00 is the last daytime hour; 18:00 is the first evening one.
    expect(checkBooking(request({ slotIndex: 11 }))).toMatchObject({
      tier: 'day',
    });
    expect(checkBooking(request({ slotIndex: 12 }))).toMatchObject({
      tier: 'night',
    });
  });

  it('refuses hours after the courts close', () => {
    // Slot 15 starts at 21:00.
    const early = { ...DEFAULT_SCHEDULE, closeHour: 21 };
    expect(
      checkBooking(request({ slotIndex: 15, schedule: early })),
    ).toMatchObject({ ok: false, code: 'closed_hours' });
    // 20:00 is the last open hour under that schedule.
    expect(
      checkBooking(request({ slotIndex: 14, schedule: early })),
    ).toMatchObject({ ok: true, tier: 'night' });
    // With the default midnight close, 21:00 is fine.
    expect(checkBooking(request({ slotIndex: 15 }))).toMatchObject({ ok: true });
  });

  describe('guests', () => {
    it('cannot take the free morning', () => {
      const result = checkBooking(
        request({ bookerType: 'guest', slotIndex: FREE_SLOT }),
      );
      expect(result).toMatchObject({ ok: false, code: 'guest_free_hours' });
      if (!result.ok) expect(result.message).toContain('9:00 AM');
    });

    it('can book paid hours', () => {
      expect(
        checkBooking(request({ bookerType: 'guest', slotIndex: DAY_SLOT })),
      ).toMatchObject({ ok: true, tier: 'day' });
      expect(
        checkBooking(request({ bookerType: 'guest', slotIndex: NIGHT_SLOT })),
      ).toMatchObject({ ok: true, tier: 'night' });
    });

    it('follows the free-hour boundary when the association moves it', () => {
      const shorter = { ...DEFAULT_SCHEDULE, freeUntilHour: 8 };
      // 08:00 is now paid, so a guest may take it.
      expect(
        checkBooking(
          request({ bookerType: 'guest', slotIndex: 2, schedule: shorter }),
        ),
      ).toMatchObject({ ok: true, tier: 'day' });
    });
  });

  it('rejects a slot that has already started', () => {
    expect(
      checkBooking(
        request({
          date: '2026-08-13',
          slotIndex: FREE_SLOT,
          now: { date: '2026-08-13', minutes: 6 * 60 + 30 },
        }),
      ),
    ).toMatchObject({ ok: false, code: 'past' });
  });

  it('allows the last day of the booking window but not beyond', () => {
    expect(checkBooking(request({ date: '2026-08-20' }))).toMatchObject({
      ok: true,
    });
    expect(checkBooking(request({ date: '2026-08-21' }))).toMatchObject({
      ok: false,
      code: 'too_far',
    });
  });

  it('rejects a court that does not exist for that sport', () => {
    expect(
      checkBooking(request({ date: '2026-08-14', courtNo: 2 })),
    ).toMatchObject({ ok: false, code: 'invalid_court' });
    expect(
      checkBooking(request({ date: '2026-08-20', courtNo: 4 })),
    ).toMatchObject({ ok: true });
  });

  it('rejects an out-of-range slot index', () => {
    expect(checkBooking(request({ slotIndex: 99 }))).toMatchObject({
      ok: false,
      code: 'invalid_slot',
    });
  });

  it('blocks a blacklisted booker', () => {
    const result = checkBooking(
      request({ booker: booker({ isBlocked: true }) }),
    );
    expect(result).toMatchObject({ ok: false, code: 'booker_blocked' });
    if (!result.ok) expect(result.message).not.toMatch(/blacklist/i);
  });

  describe('free-hour limits', () => {
    it('enforces one free booking per booker per day', () => {
      const state = booker({ bookings: [held('2026-08-14')] });
      expect(checkBooking(request({ booker: state }))).toMatchObject({
        ok: false,
        code: 'day_limit',
      });
    });

    it('enforces two free bookings per booker per week', () => {
      const state = booker({
        bookings: [held('2026-08-10'), held('2026-08-12')],
      });
      expect(
        checkBooking(request({ date: '2026-08-14', booker: state })),
      ).toMatchObject({ ok: false, code: 'week_limit' });
    });

    it('resets the weekly allowance on Monday', () => {
      const state = booker({
        bookings: [held('2026-08-15'), held('2026-08-16')],
      });
      expect(
        checkBooking(request({ date: '2026-08-14', booker: state })),
      ).toMatchObject({ ok: false, code: 'week_limit' });
      expect(
        checkBooking(request({ date: '2026-08-17', booker: state })),
      ).toMatchObject({ ok: true });
    });

    it('does not count paid bookings against the allowance', () => {
      const state = booker({
        bookings: [
          held('2026-08-14', 'day'),
          held('2026-08-10', 'night'),
          held('2026-08-12', 'day'),
        ],
      });
      expect(checkBooking(request({ booker: state }))).toMatchObject({
        ok: true,
      });
    });

    it('does not cap paid bookings at all', () => {
      const state = booker({
        bookings: [
          held('2026-08-14', 'day'),
          held('2026-08-14', 'night'),
          held('2026-08-10'),
          held('2026-08-12'),
        ],
      });
      // Free allowance is spent, but a paid slot on the same day is still fine.
      expect(
        checkBooking(request({ slotIndex: DAY_SLOT, booker: state })),
      ).toMatchObject({ ok: true });
      expect(checkBooking(request({ booker: state }))).toMatchObject({
        ok: false,
        code: 'week_limit',
      });
    });

    it('frees the allowance when a booking is cancelled', () => {
      const state = booker({ bookings: [held('2026-08-10')] });
      expect(
        checkBooking(request({ date: '2026-08-14', booker: state })),
      ).toMatchObject({ ok: true });
    });
  });

  it('honours closures', () => {
    const wholeDay: Closure = {
      dateFrom: '2026-08-14',
      dateTo: '2026-08-14',
      slotIndex: null,
      courtNo: null,
      reason: 'Resurfacing works',
    };
    const result = checkBooking(request({ closures: [wholeDay] }));
    expect(result).toMatchObject({ ok: false, code: 'closed' });
    if (!result.ok) expect(result.message).toContain('Resurfacing works');
  });

  it('applies a slot-specific closure only to that slot', () => {
    const closure: Closure = {
      dateFrom: '2026-08-14',
      dateTo: '2026-08-14',
      slotIndex: FREE_SLOT,
      courtNo: null,
      reason: 'Association event',
    };
    expect(
      checkBooking(request({ slotIndex: FREE_SLOT, closures: [closure] })),
    ).toMatchObject({ ok: false, code: 'closed' });
    expect(
      checkBooking(request({ slotIndex: 1, closures: [closure] })),
    ).toMatchObject({ ok: true });
  });

  it('rejects a slot someone else already holds', () => {
    const taken = [{ date: '2026-08-14', slotIndex: FREE_SLOT, courtNo: 1 }];
    expect(checkBooking(request({ taken }))).toMatchObject({
      ok: false,
      code: 'taken',
    });
  });

  describe('when limits are switched off', () => {
    const off: BookingLimits = { ...DEFAULT_LIMITS, enabled: false };

    it('drops the per-booker and advance-window limits', () => {
      const state = booker({
        bookings: [held('2026-08-14'), held('2026-08-12')],
      });
      expect(
        checkBooking(request({ limits: off, booker: state })),
      ).toMatchObject({ ok: true });
      expect(
        checkBooking(request({ limits: off, date: '2026-09-30' })),
      ).toMatchObject({ ok: true });
    });

    it('still refuses past slots, taken slots and guests in free hours', () => {
      expect(
        checkBooking(request({ limits: off, date: '2026-08-12' })),
      ).toMatchObject({ ok: false, code: 'past' });

      const taken = [{ date: '2026-08-14', slotIndex: FREE_SLOT, courtNo: 1 }];
      expect(checkBooking(request({ limits: off, taken }))).toMatchObject({
        ok: false,
        code: 'taken',
      });

      expect(
        checkBooking(request({ limits: off, bookerType: 'guest' })),
      ).toMatchObject({ ok: false, code: 'guest_free_hours' });
    });
  });
});

describe('findClosure', () => {
  const closure: Closure = {
    dateFrom: '2026-08-14',
    dateTo: '2026-08-16',
    slotIndex: null,
    courtNo: null,
    reason: 'Typhoon',
  };

  it('matches inclusively across the whole range', () => {
    expect(findClosure([closure], '2026-08-14', 0, 1)).not.toBeNull();
    expect(findClosure([closure], '2026-08-15', 2, 1)).not.toBeNull();
    expect(findClosure([closure], '2026-08-16', 1, 1)).not.toBeNull();
  });

  it('does not match outside the range', () => {
    expect(findClosure([closure], '2026-08-13', 0, 1)).toBeNull();
    expect(findClosure([closure], '2026-08-17', 0, 1)).toBeNull();
  });
});

describe('bookerUsage', () => {
  it('counts only free bookings, same day and same week', () => {
    const state = booker({
      bookings: [
        held('2026-08-14'),
        held('2026-08-14', 'day'), // paid, ignored
        held('2026-08-10'),
        held('2026-08-17'), // next week
      ],
    });
    expect(bookerUsage(state, '2026-08-14', DEFAULT_LIMITS)).toEqual({
      dayUsed: 1,
      dayMax: 1,
      weekUsed: 2,
      weekMax: 2,
    });
  });
});

describe('computeDayAvailability', () => {
  const base = {
    now: NOW,
    limits: DEFAULT_LIMITS,
    schedule: DEFAULT_SCHEDULE,
    pricing: DEFAULT_PRICING,
    closures: [] as Closure[],
    taken: [] as { date: string; slotIndex: number; courtNo: number }[],
  };

  it('groups the day into free, daytime and evening', () => {
    const day = computeDayAvailability({ ...base, date: '2026-08-13' });
    expect(day.groups.map((group) => group.tier)).toEqual([
      'free',
      'day',
      'night',
    ]);
    expect(day.groups[0].slots).toHaveLength(3);
    expect(day.groups[1].slots).toHaveLength(9);
    expect(day.groups[2].slots).toHaveLength(6);
  });

  it('reports full capacity for an untouched pickleball day', () => {
    const day = computeDayAvailability({ ...base, date: '2026-08-13' });
    expect(day.sport).toBe('pickleball');
    expect(day.capacity).toBe(18 * 4);
    expect(day.openCount).toBe(18 * 4);
    expect(day.groups[0].slots[0].courts).toHaveLength(4);
  });

  it('prices each group for the day sport', () => {
    const day = computeDayAvailability({ ...base, date: '2026-08-13' });
    expect(day.groups.map((group) => group.price)).toEqual([0, 200, 350]);

    const tennis = computeDayAvailability({ ...base, date: '2026-08-14' });
    expect(tennis.groups.map((group) => group.price)).toEqual([0, 350, 400]);
  });

  it('drops slots after closing time', () => {
    const day = computeDayAvailability({
      ...base,
      date: '2026-08-14',
      schedule: { ...DEFAULT_SCHEDULE, closeHour: 20 },
    });
    expect(day.capacity).toBe(14); // 06:00–20:00, one court
    expect(day.groups[2].slots).toHaveLength(2); // 18:00 and 19:00
  });

  it('subtracts taken courts', () => {
    const day = computeDayAvailability({
      ...base,
      date: '2026-08-13',
      taken: [
        { date: '2026-08-13', slotIndex: 0, courtNo: 1 },
        { date: '2026-08-13', slotIndex: 0, courtNo: 2 },
      ],
    });
    expect(day.groups[0].slots[0].openCount).toBe(2);
    expect(day.groups[0].slots[0].courts[0].status).toBe('taken');
    expect(day.openCount).toBe(18 * 4 - 2);
  });

  it('marks slots that have already started as past', () => {
    const day = computeDayAvailability({
      ...base,
      date: '2026-08-13',
      now: { date: '2026-08-13', minutes: 7 * 60 + 30 },
    });
    const free = day.groups[0];
    expect(free.slots[0].courts.every((c) => c.status === 'past')).toBe(true);
    expect(free.slots[1].courts.every((c) => c.status === 'past')).toBe(true);
    expect(free.slots[2].openCount).toBe(4);
  });

  it('marks closed courts with their reason', () => {
    const day = computeDayAvailability({
      ...base,
      date: '2026-08-13',
      closures: [
        {
          dateFrom: '2026-08-13',
          dateTo: '2026-08-13',
          slotIndex: 1,
          courtNo: 3,
          reason: 'Net replacement',
        },
      ],
    });
    expect(day.groups[0].slots[1].courts[2]).toEqual({
      courtNo: 3,
      status: 'closed',
      reason: 'Net replacement',
    });
  });

  it('finds a slot regardless of which group it is in', () => {
    const day = computeDayAvailability({ ...base, date: '2026-08-14' });
    expect(findSlotAvailability(day, NIGHT_SLOT)?.tier).toBe('night');
    expect(findSlotAvailability(day, FREE_SLOT)?.tier).toBe('free');
    expect(findSlotAvailability(day, 99)).toBeNull();
  });

  it('flags dates outside the booking window', () => {
    expect(
      computeDayAvailability({ ...base, date: '2026-08-21' }).withinWindow,
    ).toBe(false);
    expect(
      computeDayAvailability({ ...base, date: '2026-08-12' }).withinWindow,
    ).toBe(false);
  });
});

describe('bookableDates', () => {
  it('starts today and spans the advance window inclusively', () => {
    const dates = bookableDates(NOW, DEFAULT_LIMITS);
    expect(dates).toHaveLength(8);
    expect(dates[0]).toBe('2026-08-13');
    expect(dates.at(-1)).toBe('2026-08-20');
  });
});
