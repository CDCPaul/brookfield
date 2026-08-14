import { describe, expect, it } from 'vitest';

import { DEFAULT_COURT_CONFIG, findOption } from './courts';
import {
  type BookerState,
  type BookingLimits,
  type BookingRequest,
  type Closure,
  type HeldResource,
  DEFAULT_LIMITS,
  EMPTY_BOOKER,
  bookableDates,
  bookerUsage,
  checkBooking,
  closureRangeLabel,
  computeDayAvailability,
  findClosure,
  findSlotAvailability,
  isPastSlot,
} from './rules';
import { DEFAULT_PRICING, DEFAULT_SCHEDULE, type Tier, getSlot } from './schedule';
import type { ManilaMoment } from './time';

// 2026-08-14 is a Friday (tennis day); 2026-08-13 a Thursday (pickleball day).
// Slot index n starts at hour 6 + n: 0–2 free, 3–11 daytime, 12–17 evening.
const NOW: ManilaMoment = { date: '2026-08-13', minutes: 5 * 60 };

const TENNIS_DATE = '2026-08-14';
const PICKLEBALL_DATE = '2026-08-20'; // Thursday, a week out
const FREE_SLOT = 0;
const DAY_SLOT = 4;
const NIGHT_SLOT = 13;

const PAID_COURTS = { ...DEFAULT_COURT_CONFIG, paidTennisEnabled: true };

function held(
  date: string,
  slotIndex: number,
  optionKey: string,
): HeldResource[] {
  const option = findOption(optionKey);
  if (!option) throw new Error(`missing option ${optionKey}`);
  return option.resources.map((resourceKey) => ({
    date,
    slotIndex,
    resourceKey,
    optionKey,
    bookerName: 'Ana Cruz',
  }));
}

function booker(overrides: Partial<BookerState> = {}): BookerState {
  return { ...EMPTY_BOOKER, ...overrides };
}

function booking(date: string, tier: Tier = 'free') {
  return { date, isFree: tier === 'free' };
}

function request(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    date: TENNIS_DATE,
    slotIndex: FREE_SLOT,
    optionKey: 'tennis',
    bookerType: 'resident',
    now: NOW,
    limits: DEFAULT_LIMITS,
    schedule: DEFAULT_SCHEDULE,
    pricing: DEFAULT_PRICING,
    courts: DEFAULT_COURT_CONFIG,
    closures: [],
    held: [],
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
});

describe('checkBooking — shared courts', () => {
  it('accepts the free morning tennis court at no charge', () => {
    expect(checkBooking(request())).toMatchObject({
      ok: true,
      tier: 'free',
      price: 0,
    });
  });

  it('blocks tennis when any single pickleball court is held', () => {
    for (const key of ['pb1', 'pb2', 'pb3', 'pb4']) {
      const result = checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'tennis',
          courts: PAID_COURTS,
          held: held(PICKLEBALL_DATE, DAY_SLOT, key),
        }),
      );
      expect(result).toMatchObject({ ok: false, code: 'taken' });
      if (!result.ok) {
        expect(result.message).toContain(findOption(key)!.label);
      }
    }
  });

  it('blocks every pickleball court when tennis is held', () => {
    for (const key of ['pb1', 'pb2', 'pb3', 'pb4']) {
      expect(
        checkBooking(
          request({
            date: PICKLEBALL_DATE,
            slotIndex: DAY_SLOT,
            optionKey: key,
            held: held(PICKLEBALL_DATE, DAY_SLOT, 'tennis'),
          }),
        ),
      ).toMatchObject({ ok: false, code: 'taken' });
    }
  });

  it('lets two different pickleball courts coexist', () => {
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'pb3',
          held: held(PICKLEBALL_DATE, DAY_SLOT, 'pb1'),
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it('blocks the full basketball court when one half is held', () => {
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'bbFull',
          held: held(PICKLEBALL_DATE, DAY_SLOT, 'bbA'),
        }),
      ),
    ).toMatchObject({ ok: false, code: 'taken' });
  });

  it('leaves the other half free', () => {
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'bbB',
          held: held(PICKLEBALL_DATE, DAY_SLOT, 'bbA'),
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it('keeps the two surfaces independent', () => {
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'bbA',
          held: held(PICKLEBALL_DATE, DAY_SLOT, 'pb1'),
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it('only conflicts within the same slot', () => {
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'pb1',
          held: held(PICKLEBALL_DATE, DAY_SLOT + 1, 'tennis'),
        }),
      ),
    ).toMatchObject({ ok: true });
  });
});

describe('checkBooking — pricing and tiers', () => {
  it('charges the pickleball rate per court', () => {
    expect(
      checkBooking(
        request({ date: PICKLEBALL_DATE, slotIndex: DAY_SLOT, optionKey: 'pb2' }),
      ),
    ).toMatchObject({ tier: 'day', price: 200 });
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: NIGHT_SLOT,
          optionKey: 'pb2',
        }),
      ),
    ).toMatchObject({ tier: 'night', price: 350 });
  });

  it('charges a basketball half like a pickleball court, full as two', () => {
    expect(
      checkBooking(
        request({ date: PICKLEBALL_DATE, slotIndex: DAY_SLOT, optionKey: 'bbA' }),
      ),
    ).toMatchObject({ price: 200 });
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'bbFull',
        }),
      ),
    ).toMatchObject({ price: 400 });
  });

  it('refuses hours after the courts close', () => {
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: 15,
          optionKey: 'pb1',
          schedule: { ...DEFAULT_SCHEDULE, closeHour: 21 },
        }),
      ),
    ).toMatchObject({ ok: false, code: 'closed_hours' });
  });
});

describe('checkBooking — who may book what', () => {
  it('refuses a guest in the free morning', () => {
    const result = checkBooking(request({ bookerType: 'guest' }));
    expect(result).toMatchObject({ ok: false, code: 'guest_free_hours' });
    if (!result.ok) expect(result.message).toContain('9:00 AM');
  });

  it('lets a guest book paid hours', () => {
    expect(
      checkBooking(
        request({
          bookerType: 'guest',
          date: PICKLEBALL_DATE,
          slotIndex: NIGHT_SLOT,
          optionKey: 'pb1',
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it('offers only tennis in the free morning on a tennis day', () => {
    expect(
      checkBooking(request({ optionKey: 'pb1' })),
    ).toMatchObject({ ok: false, code: 'invalid_option' });
  });

  it('offers only pickleball in the free morning on a pickleball day', () => {
    expect(
      checkBooking(
        request({ date: PICKLEBALL_DATE, optionKey: 'pb1' }),
      ),
    ).toMatchObject({ ok: true, price: 0 });
    expect(
      checkBooking(request({ date: PICKLEBALL_DATE, optionKey: 'tennis' })),
    ).toMatchObject({ ok: false, code: 'invalid_option' });
  });

  it('opens basketball in the morning but charges for it', () => {
    expect(
      checkBooking(request({ date: PICKLEBALL_DATE, optionKey: 'bbA' })),
    ).toMatchObject({ ok: true, price: 200 });
  });

  it('lets a guest take the basketball court in the morning, since it is paid', () => {
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          optionKey: 'bbA',
          bookerType: 'guest',
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it('does not count paid morning basketball against the free allowance', () => {
    const spent = booker({
      bookings: [booking('2026-08-10'), booking('2026-08-12')],
    });
    expect(
      checkBooking(
        request({ date: PICKLEBALL_DATE, optionKey: 'bbA', booker: spent }),
      ),
    ).toMatchObject({ ok: true });
  });

  it('withholds paid tennis until the association enables it', () => {
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'tennis',
        }),
      ),
    ).toMatchObject({ ok: false, code: 'invalid_option' });
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'tennis',
          courts: PAID_COURTS,
        }),
      ),
    ).toMatchObject({ ok: true, price: 350 });
  });
});

describe('checkBooking — limits and closures', () => {
  it('counts only free bookings against the allowance', () => {
    const paidHeavy = booker({
      bookings: [
        booking(TENNIS_DATE, 'day'),
        booking('2026-08-10', 'night'),
        booking('2026-08-12', 'day'),
      ],
    });
    expect(checkBooking(request({ booker: paidHeavy }))).toMatchObject({
      ok: true,
    });
  });

  it('enforces the daily and weekly free limits', () => {
    expect(
      checkBooking(
        request({ booker: booker({ bookings: [booking(TENNIS_DATE)] }) }),
      ),
    ).toMatchObject({ ok: false, code: 'day_limit' });

    expect(
      checkBooking(
        request({
          booker: booker({
            bookings: [booking('2026-08-10'), booking('2026-08-12')],
          }),
        }),
      ),
    ).toMatchObject({ ok: false, code: 'week_limit' });
  });

  it('never caps paid bookings', () => {
    const spent = booker({
      bookings: [booking('2026-08-10'), booking('2026-08-12')],
    });
    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'pb1',
          booker: spent,
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it('closes a whole surface, and only that surface', () => {
    const closure: Closure = {
      dateFrom: PICKLEBALL_DATE,
      dateTo: PICKLEBALL_DATE,
      slotFrom: null,
      slotTo: null,
      venue: 'tennis-court',
      reason: 'Resurfacing works',
    };

    const blocked = checkBooking(
      request({
        date: PICKLEBALL_DATE,
        slotIndex: DAY_SLOT,
        optionKey: 'pb1',
        closures: [closure],
      }),
    );
    expect(blocked).toMatchObject({ ok: false, code: 'closed' });
    if (!blocked.ok) expect(blocked.message).toContain('Resurfacing works');

    expect(
      checkBooking(
        request({
          date: PICKLEBALL_DATE,
          slotIndex: DAY_SLOT,
          optionKey: 'bbA',
          closures: [closure],
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it('blocks a blacklisted booker', () => {
    expect(
      checkBooking(request({ booker: booker({ isBlocked: true }) })),
    ).toMatchObject({ ok: false, code: 'booker_blocked' });
  });

  it('allows the last day of the window but not beyond', () => {
    // 08-20 is a pickleball day, so the free morning offers pb courts.
    expect(
      checkBooking(request({ date: PICKLEBALL_DATE, optionKey: 'pb1' })),
    ).toMatchObject({ ok: true });
    expect(checkBooking(request({ date: '2026-08-21' }))).toMatchObject({
      ok: false,
      code: 'too_far',
    });
  });

  describe('when limits are switched off', () => {
    const off: BookingLimits = { ...DEFAULT_LIMITS, enabled: false };

    it('drops the allowance but keeps everything else', () => {
      expect(
        checkBooking(
          request({
            limits: off,
            booker: booker({ bookings: [booking(TENNIS_DATE)] }),
          }),
        ),
      ).toMatchObject({ ok: true });

      expect(
        checkBooking(request({ limits: off, bookerType: 'guest' })),
      ).toMatchObject({ ok: false, code: 'guest_free_hours' });

      expect(
        checkBooking(
          request({ limits: off, held: held(TENNIS_DATE, FREE_SLOT, 'pb1') }),
        ),
      ).toMatchObject({ ok: false, code: 'taken' });
    });
  });
});

describe('findClosure', () => {
  const closure: Closure = {
    dateFrom: '2026-08-14',
    dateTo: '2026-08-16',
    slotFrom: null,
    slotTo: null,
    venue: null,
    reason: 'Typhoon',
  };

  it('matches inclusively across the range and both surfaces', () => {
    expect(findClosure([closure], '2026-08-14', 0, 'tennis-court')).not.toBeNull();
    expect(
      findClosure([closure], '2026-08-16', 5, 'basketball-court'),
    ).not.toBeNull();
  });

  it('does not match outside the range', () => {
    expect(findClosure([closure], '2026-08-13', 0, 'tennis-court')).toBeNull();
    expect(findClosure([closure], '2026-08-17', 0, 'tennis-court')).toBeNull();
  });

  it('covers an inclusive band of hours', () => {
    // 09:00 to 12:00 inclusive — slots 3, 4, 5 and 6.
    const morning: Closure = {
      dateFrom: '2026-08-14',
      dateTo: '2026-08-14',
      slotFrom: 3,
      slotTo: 6,
      venue: null,
      reason: 'Works',
    };

    expect(findClosure([morning], '2026-08-14', 2, 'tennis-court')).toBeNull();
    expect(
      findClosure([morning], '2026-08-14', 3, 'tennis-court'),
    ).not.toBeNull();
    expect(
      findClosure([morning], '2026-08-14', 6, 'tennis-court'),
    ).not.toBeNull();
    expect(findClosure([morning], '2026-08-14', 7, 'tennis-court')).toBeNull();
  });

  it('treats an open end as running to closing time', () => {
    const evening: Closure = {
      dateFrom: '2026-08-14',
      dateTo: '2026-08-14',
      slotFrom: 12,
      slotTo: null,
      venue: null,
      reason: 'Event',
    };

    expect(findClosure([evening], '2026-08-14', 11, 'tennis-court')).toBeNull();
    expect(
      findClosure([evening], '2026-08-14', 17, 'tennis-court'),
    ).not.toBeNull();
  });
});

describe('closureRangeLabel', () => {
  const base = {
    dateFrom: '2026-08-14',
    dateTo: '2026-08-14',
    venue: null,
    reason: 'Works',
  };

  it('says all day when no hours are given', () => {
    expect(
      closureRangeLabel({ ...base, slotFrom: null, slotTo: null }),
    ).toBe('all day');
  });

  it('reads from the start of the first hour to the end of the last', () => {
    expect(closureRangeLabel({ ...base, slotFrom: 0, slotTo: 2 })).toBe(
      '6:00 AM – 9:00 AM',
    );
    expect(closureRangeLabel({ ...base, slotFrom: 12, slotTo: null })).toBe(
      '6:00 PM – 12:00 AM',
    );
  });
});

describe('bookerUsage', () => {
  it('counts only free bookings, same day and same week', () => {
    const state = booker({
      bookings: [
        booking('2026-08-14'),
        booking('2026-08-14', 'day'),
        booking('2026-08-10'),
        booking('2026-08-17'),
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
    courts: DEFAULT_COURT_CONFIG,
    closures: [] as Closure[],
    held: [] as HeldResource[],
  };

  it('filters to one activity for the sport tabs', () => {
    const day = computeDayAvailability({
      ...base,
      date: PICKLEBALL_DATE,
      activity: 'basketball',
    });
    expect(day.groups.map((group) => group.tier)).toEqual([
      'free',
      'day',
      'night',
    ]);
    // Nothing in the early block is free for basketball, so it is not labelled
    // as the free morning.
    expect(day.groups[0].label).toBe('Early morning');
    expect(day.groups[0].slots[0].options).toHaveLength(3);
    expect(day.groups[0].slots[0].options[0].price).toBe(200);
  });

  it('reports the free morning for the day sport only', () => {
    const tennis = computeDayAvailability({
      ...base,
      date: TENNIS_DATE,
      activity: 'tennis',
    });
    expect(tennis.groups[0].tier).toBe('free');
    expect(tennis.groups[0].slots[0].options).toHaveLength(1);

    const pickleball = computeDayAvailability({
      ...base,
      date: TENNIS_DATE,
      activity: 'pickleball',
    });
    expect(pickleball.groups.map((group) => group.tier)).toEqual([
      'day',
      'night',
    ]);
  });

  it('marks a court taken and says what is in the way', () => {
    const day = computeDayAvailability({
      ...base,
      date: PICKLEBALL_DATE,
      activity: 'tennis',
      courts: PAID_COURTS,
      held: held(PICKLEBALL_DATE, DAY_SLOT, 'pb2'),
    });

    const slot = findSlotAvailability(day, DAY_SLOT);
    expect(slot?.options[0].status).toBe('taken');
    expect(slot?.options[0].reason).toContain('Pickleball court 2');
    // Naming the holder shows the court is genuinely spoken for.
    expect(slot?.options[0].reason).toContain('Ana Cruz');
    expect(slot?.options[0].heldBy).toBe('Ana Cruz');
  });

  it('marks slots that have already started as past', () => {
    const day = computeDayAvailability({
      ...base,
      date: '2026-08-13',
      activity: 'pickleball',
      now: { date: '2026-08-13', minutes: 7 * 60 + 30 },
    });
    const free = day.groups[0];
    expect(free.slots[0].options.every((o) => o.status === 'past')).toBe(true);
    expect(free.slots[2].openCount).toBe(4);
  });

  it('flags dates outside the booking window', () => {
    expect(
      computeDayAvailability({ ...base, date: '2026-08-21' }).withinWindow,
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
