import { describe, expect, it } from 'vitest';

import {
  type BookingLimits,
  type BookingRequest,
  type Closure,
  DEFAULT_LIMITS,
  EMPTY_BOOKER,
  bookableDates,
  bookerUsage,
  checkBooking,
  computeDayAvailability,
  findClosure,
  isPastSlot,
} from './rules';
import { getSlot } from './schedule';
import type { ManilaMoment } from './time';

// 2026-08-13 is a Thursday (pickleball, 4 courts).
// 2026-08-14 is a Friday (tennis, 1 court).
// The week runs Mon 2026-08-10 through Sun 2026-08-16.
const NOW: ManilaMoment = { date: '2026-08-13', minutes: 5 * 60 };

function request(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    date: '2026-08-14',
    slotIndex: 0,
    courtNo: 1,
    now: NOW,
    limits: DEFAULT_LIMITS,
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
  it('accepts a valid booking', () => {
    expect(checkBooking(request())).toEqual({ ok: true });
  });

  it('rejects a slot that has already started', () => {
    const result = checkBooking(
      request({
        date: '2026-08-13',
        slotIndex: 0,
        now: { date: '2026-08-13', minutes: 6 * 60 + 30 },
      }),
    );
    expect(result).toMatchObject({ ok: false, code: 'past' });
  });

  it('allows the last day of the booking window but not beyond', () => {
    expect(checkBooking(request({ date: '2026-08-20' }))).toEqual({ ok: true });
    expect(checkBooking(request({ date: '2026-08-21' }))).toMatchObject({
      ok: false,
      code: 'too_far',
    });
  });

  it('rejects a court that does not exist for that sport', () => {
    // Friday is tennis: only court 1 exists.
    expect(
      checkBooking(request({ date: '2026-08-14', courtNo: 2 })),
    ).toMatchObject({ ok: false, code: 'invalid_court' });
    // Thursday is pickleball: court 4 is fine.
    expect(checkBooking(request({ date: '2026-08-20', courtNo: 4 }))).toEqual({
      ok: true,
    });
  });

  it('rejects an out-of-range slot index', () => {
    expect(checkBooking(request({ slotIndex: 3 }))).toMatchObject({
      ok: false,
      code: 'invalid_slot',
    });
  });

  it('blocks a blacklisted booker', () => {
    const result = checkBooking(
      request({ booker: { isBlocked: true, bookings: [] } }),
    );
    expect(result).toMatchObject({ ok: false, code: 'booker_blocked' });
    // The reason is deliberately not disclosed to the resident.
    if (!result.ok) expect(result.message).not.toMatch(/blacklist/i);
  });

  it('enforces one booking per booker per day', () => {
    const booker = { isBlocked: false, bookings: [{ date: '2026-08-14' }] };
    expect(checkBooking(request({ booker }))).toMatchObject({
      ok: false,
      code: 'day_limit',
    });
  });

  it('enforces two bookings per booker per week', () => {
    const booker = {
      isBlocked: false,
      bookings: [{ date: '2026-08-10' }, { date: '2026-08-12' }],
    };
    expect(checkBooking(request({ date: '2026-08-14', booker }))).toMatchObject({
      ok: false,
      code: 'week_limit',
    });
  });

  it('resets the weekly allowance on Monday', () => {
    const booker = {
      isBlocked: false,
      bookings: [{ date: '2026-08-15' }, { date: '2026-08-16' }],
    };
    // Fri 08-14 is still the old week; Mon 08-17 starts a fresh allowance.
    expect(checkBooking(request({ date: '2026-08-14', booker }))).toMatchObject({
      ok: false,
      code: 'week_limit',
    });
    expect(checkBooking(request({ date: '2026-08-17', booker }))).toEqual({
      ok: true,
    });
  });

  it('frees the allowance when a booking is cancelled', () => {
    // Cancelled bookings are simply absent from booker.bookings.
    const booker = { isBlocked: false, bookings: [{ date: '2026-08-10' }] };
    expect(checkBooking(request({ date: '2026-08-14', booker }))).toEqual({
      ok: true,
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
      slotIndex: 0,
      courtNo: null,
      reason: 'Association event',
    };
    expect(
      checkBooking(request({ slotIndex: 0, closures: [closure] })),
    ).toMatchObject({ ok: false, code: 'closed' });
    expect(checkBooking(request({ slotIndex: 1, closures: [closure] }))).toEqual(
      { ok: true },
    );
  });

  it('applies a court-specific closure only to that court', () => {
    const closure: Closure = {
      dateFrom: '2026-08-20',
      dateTo: '2026-08-20',
      slotIndex: null,
      courtNo: 2,
      reason: 'Net replacement',
    };
    expect(
      checkBooking(
        request({ date: '2026-08-20', courtNo: 2, closures: [closure] }),
      ),
    ).toMatchObject({ ok: false, code: 'closed' });
    expect(
      checkBooking(
        request({ date: '2026-08-20', courtNo: 3, closures: [closure] }),
      ),
    ).toEqual({ ok: true });
  });

  it('rejects a slot someone else already holds', () => {
    const taken = [{ date: '2026-08-14', slotIndex: 0, courtNo: 1 }];
    expect(checkBooking(request({ taken }))).toMatchObject({
      ok: false,
      code: 'taken',
    });
  });

  it('ignores bookings on other dates when checking availability', () => {
    const taken = [{ date: '2026-08-16', slotIndex: 0, courtNo: 1 }];
    expect(checkBooking(request({ taken }))).toEqual({ ok: true });
  });

  describe('when limits are switched off', () => {
    const off: BookingLimits = { ...DEFAULT_LIMITS, enabled: false };

    it('drops the per-booker and advance-window limits', () => {
      const booker = {
        isBlocked: false,
        bookings: [{ date: '2026-08-14' }, { date: '2026-08-12' }],
      };
      expect(checkBooking(request({ limits: off, booker }))).toEqual({
        ok: true,
      });
      expect(checkBooking(request({ limits: off, date: '2026-09-30' }))).toEqual(
        { ok: true },
      );
    });

    it('still refuses past slots and taken slots', () => {
      expect(
        checkBooking(request({ limits: off, date: '2026-08-12' })),
      ).toMatchObject({ ok: false, code: 'past' });

      const taken = [{ date: '2026-08-14', slotIndex: 0, courtNo: 1 }];
      expect(checkBooking(request({ limits: off, taken }))).toMatchObject({
        ok: false,
        code: 'taken',
      });
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
  it('counts same-day and same-week bookings', () => {
    const booker = {
      isBlocked: false,
      bookings: [
        { date: '2026-08-14' },
        { date: '2026-08-10' },
        { date: '2026-08-17' }, // next week
      ],
    };
    expect(bookerUsage(booker, '2026-08-14', DEFAULT_LIMITS)).toEqual({
      dayUsed: 1,
      dayMax: 1,
      weekUsed: 2,
      weekMax: 2,
    });
  });

  it('is identical for residents and guests — only the bookings matter', () => {
    const bookings = [{ date: '2026-08-14' }];
    expect(
      bookerUsage({ isBlocked: false, bookings }, '2026-08-14', DEFAULT_LIMITS),
    ).toEqual(
      bookerUsage({ isBlocked: false, bookings }, '2026-08-14', DEFAULT_LIMITS),
    );
  });
});

describe('computeDayAvailability', () => {
  const base = {
    now: NOW,
    limits: DEFAULT_LIMITS,
    closures: [] as Closure[],
    taken: [] as { date: string; slotIndex: number; courtNo: number }[],
  };

  it('reports full capacity for an untouched pickleball day', () => {
    const day = computeDayAvailability({ ...base, date: '2026-08-13' });
    expect(day.sport).toBe('pickleball');
    expect(day.capacity).toBe(12);
    expect(day.openCount).toBe(12);
    expect(day.slots).toHaveLength(3);
    expect(day.slots[0].courts).toHaveLength(4);
    expect(day.withinWindow).toBe(true);
  });

  it('reports a single court on a tennis day', () => {
    const day = computeDayAvailability({ ...base, date: '2026-08-14' });
    expect(day.sport).toBe('tennis');
    expect(day.capacity).toBe(3);
    expect(day.slots[0].courts).toHaveLength(1);
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
    expect(day.openCount).toBe(10);
    expect(day.slots[0].openCount).toBe(2);
    expect(day.slots[0].courts[0].status).toBe('taken');
    expect(day.slots[0].courts[2].status).toBe('open');
  });

  it('marks slots that have already started as past', () => {
    const day = computeDayAvailability({
      ...base,
      date: '2026-08-13',
      now: { date: '2026-08-13', minutes: 7 * 60 + 30 },
    });
    expect(day.slots[0].courts.every((c) => c.status === 'past')).toBe(true);
    expect(day.slots[1].courts.every((c) => c.status === 'past')).toBe(true);
    expect(day.slots[2].openCount).toBe(4);
    expect(day.openCount).toBe(4);
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
    expect(day.slots[1].courts[2]).toEqual({
      courtNo: 3,
      status: 'closed',
      reason: 'Net replacement',
    });
    expect(day.openCount).toBe(11);
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
