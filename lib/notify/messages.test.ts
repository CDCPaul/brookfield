import { describe, expect, it } from 'vitest';

import {
  SMS_SINGLE_LIMIT,
  confirmedSms,
  declinedSms,
  newRequestSms,
  type RequestSummary,
} from './messages';

const line = (slotIndex: number, optionKey: string, price = 200) => ({
  slotIndex,
  optionKey,
  price,
});

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
});
