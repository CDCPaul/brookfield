import { describe, expect, it } from 'vitest';

import {
  SMS_SINGLE_LIMIT,
  confirmedPush,
  confirmedSms,
  declinedPush,
  declinedSms,
  newRequestPush,
  newRequestSms,
  type RequestSummary,
} from './messages';

const line = (slotIndex: number, optionKey: string, price = 200) => ({
  slotIndex,
  optionKey,
  price,
});

/** Every court in `courts`, for every hour in `slots`. */
const block = (courts: readonly string[], slots: readonly number[]) =>
  courts.flatMap((court) => slots.map((slot) => line(slot, court)));

const base: RequestSummary = {
  date: '2026-08-16',
  name: 'Juan Dela Cruz',
  amount: 400,
  lines: [line(6, 'pb2'), line(7, 'pb2')],
};

/** Every message must stay inside one credit — two is double the bill. */
function expectOneCredit(message: string) {
  expect(message.length).toBeLessThanOrEqual(SMS_SINGLE_LIMIT);
}

/**
 * The closing line is the part the reader acts on, so it must survive intact.
 * An ellipsis anywhere means something was clipped rather than compressed.
 */
function expectWhole(message: string, ending: string) {
  expect(message.endsWith(ending)).toBe(true);
  expect(message).not.toContain('…');
}

const CONFIRMED_TAIL = 'Arrive 10-15 min early. Water and sports drinks only.';
const REQUEST_TAIL = 'Approve in the admin page.';
const DECLINED_TAIL = 'The slot has been released.';

describe('newRequestSms', () => {
  it('names who, when and how much', () => {
    const message = newRequestSms(base);
    expect(message).toContain('NEW REQUEST');
    expect(message).toContain('P400');
    expect(message).toContain('Juan Dela Cruz');
    expect(message).toContain('Aug 16');
    expectOneCredit(message);
  });

  it('says free rather than a peso amount for the free morning', () => {
    const message = newRequestSms({
      ...base,
      amount: 0,
      lines: [line(0, 'tennis', 0)],
    });
    expect(message).toContain('free');
    expect(message).not.toContain('P0');
    expectOneCredit(message);
  });
});

describe('confirmedSms', () => {
  it('collapses consecutive hours into one range', () => {
    const message = confirmedSms(base);
    expect(message).toContain('CONFIRMED');
    // 12:00 PM to 2:00 PM on court 2, not two separate hours.
    expect(message).toContain('12PM-2PM Court 2');
    expectOneCredit(message);
  });

  it('keeps half-hour boundaries readable', () => {
    const message = confirmedSms({ ...base, lines: [line(3, 'pb1')] });
    expect(message).toContain('9AM-10AM Court 1');
    expectOneCredit(message);
  });
});

describe('declinedSms', () => {
  it('carries the association note when there is one', () => {
    const message = declinedSms(base, 'Court reserved for a tournament');
    expect(message).toContain('NOT CONFIRMED');
    expect(message).toContain('Court reserved');
    expectOneCredit(message);
  });

  it('reads fine without a note', () => {
    const message = declinedSms(base, '   ');
    expect(message).toContain('released');
    expectOneCredit(message);
  });

  it('drops the note rather than the courts or the outcome', () => {
    const message = declinedSms(
      { ...base, lines: block(['pb1', 'pb2', 'pb3', 'pb4'], [12, 13, 14]) },
      'A very long explanation of exactly why the association could not approve this particular request today',
    );
    expect(message).toContain('6PM-9PM Courts 1-4');
    expect(message).toContain(DECLINED_TAIL);
    expectOneCredit(message);
  });
});

describe('courts sharing the same hours', () => {
  it('lists four courts booked together as one range', () => {
    const message = confirmedSms({
      ...base,
      lines: block(['pb1', 'pb2', 'pb3', 'pb4'], [12, 13, 14]),
    });
    expect(message).toContain('6PM-9PM Courts 1-4');
    expectWhole(message, CONFIRMED_TAIL);
    expectOneCredit(message);
  });

  it('keeps both halves of a split booking', () => {
    const message = confirmedSms({
      ...base,
      lines: block(['pb1', 'pb2', 'pb3', 'pb4'], [12, 13, 16, 17]),
    });
    expect(message).toContain('6PM-8PM Courts 1-4');
    expect(message).toContain('10PM-12AM Courts 1-4');
    expectWhole(message, CONFIRMED_TAIL);
    expectOneCredit(message);
  });

  it('spells out courts that do not run together', () => {
    const message = confirmedSms({
      ...base,
      lines: block(['pb1', 'pb3'], [12, 13]),
    });
    expect(message).toContain('6PM-8PM Courts 1,3');
    expectWhole(message, CONFIRMED_TAIL);
    expectOneCredit(message);
  });

  it('holds a whole evening on every court', () => {
    const message = confirmedSms({
      ...base,
      lines: block(['pb1', 'pb2', 'pb3', 'pb4'], [12, 13, 14, 15, 16, 17]),
    });
    expect(message).toContain('6PM-12AM Courts 1-4');
    expectWhole(message, CONFIRMED_TAIL);
    expectOneCredit(message);
  });
});

describe('when even the compressed schedule will not fit', () => {
  /** Every other hour on every court: nothing merges, nothing groups. */
  const scattered = block(['pb1', 'pb2', 'pb3', 'pb4'], [0, 2, 4, 6, 8, 10, 12, 14, 16]);

  it('summarises rather than cutting the list off midway', () => {
    const message = confirmedSms({ ...base, lines: scattered });
    expect(message).toContain('36 hrs on 4 courts, 6AM-11PM');
    expect(message).not.toContain('Court 1,');
    expectWhole(message, CONFIRMED_TAIL);
    expectOneCredit(message);
  });

  it('still tells the association who asked and what to do', () => {
    const message = newRequestSms({ ...base, lines: scattered, amount: 7200 });
    expect(message).toContain('Juan Dela Cruz');
    expect(message).toContain('P7200');
    expectWhole(message, REQUEST_TAIL);
    expectOneCredit(message);
  });
});

describe('push notifications', () => {
  it('says the same things without paying by the character', () => {
    const push = confirmedPush({ ...base, code: 'AB12CD' });
    expect(push.title).toBe('Court confirmed');
    expect(push.body).toContain('12PM-2PM Court 2');
    expect(push.body).toContain('Water and sports drinks only');
    expect(push.url).toBe('/booking/AB12CD');
  });

  it('sends the association to the requests screen', () => {
    const push = newRequestPush({ ...base, code: 'AB12CD' });
    expect(push.title).toContain('P400');
    expect(push.body).toContain('Juan Dela Cruz');
    expect(push.url).toBe('/admin/requests');
    // The association should have to dismiss it rather than miss it.
    expect(push.important).toBe(true);
  });

  it('keeps a booking to one notification however often it is sent', () => {
    const first = confirmedPush({ ...base, code: 'AB12CD' });
    const second = declinedPush({ ...base, code: 'AB12CD' }, 'Rained off');
    expect(first.tag).toBe(second.tag);
  });

  it('falls back to the bookings list when there is no reference', () => {
    expect(confirmedPush(base).url).toBe('/my');
    expect(declinedPush(base, '').url).toBe('/my');
  });

  it('carries the reason for a decline', () => {
    const push = declinedPush({ ...base, code: 'AB12CD' }, 'Rained off');
    expect(push.body).toContain('Rained off');
    expect(push.body).toContain('released');
  });

  it('has room for a whole day across every court', () => {
    const push = confirmedPush({
      ...base,
      code: 'AB12CD',
      lines: block(['pb1', 'pb2', 'pb3', 'pb4'], [12, 13, 16, 17]),
    });
    expect(push.body).toContain('6PM-8PM Courts 1-4');
    expect(push.body).toContain('10PM-12AM Courts 1-4');
    expect(push.body).not.toContain('…');
  });
});

describe('staying inside one credit', () => {
  it('holds even for a long name and many courts', () => {
    const crowded: RequestSummary = {
      date: '2026-09-30',
      name: 'Ma. Cristina Beatriz Villanueva-Buenaventura',
      amount: 2800,
      lines: [
        line(3, 'pb1'),
        line(4, 'pb1'),
        line(3, 'pb2'),
        line(4, 'pb2'),
        line(3, 'pb3'),
        line(4, 'pb3'),
        line(12, 'bbFull', 700),
      ],
    };

    for (const message of [
      newRequestSms(crowded),
      confirmedSms(crowded),
      declinedSms(crowded, 'A very long explanation that nobody asked for'),
    ]) {
      expectOneCredit(message);
    }
  });

  it('never loses the closing line, whatever is thrown at it', () => {
    const courts = ['pb1', 'pb2', 'pb3', 'pb4'];
    const hours = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

    for (let count = 1; count <= hours.length; count += 1) {
      const lines = block(courts, hours.slice(0, count));
      const summary = { ...base, lines, amount: lines.length * 200 };
      expectWhole(confirmedSms(summary), CONFIRMED_TAIL);
      expectWhole(newRequestSms(summary), REQUEST_TAIL);
      expectWhole(declinedSms(summary, ''), DECLINED_TAIL);
    }
  });
});
