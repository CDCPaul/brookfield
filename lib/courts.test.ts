import { describe, expect, it } from 'vitest';

import {
  COURT_OPTIONS,
  DEFAULT_COURT_CONFIG,
  findOption,
  isTennisDay,
  isValidOptionKey,
  optionsConflict,
  optionsFor,
  priceForOption,
} from './courts';
import { DEFAULT_PRICING } from './schedule';

// 2026-08-10 Mon, 08-11 Tue, 08-13 Thu, 08-14 Fri, 08-16 Sun.
const TENNIS_DATE = '2026-08-14'; // Friday
const PICKLEBALL_DATE = '2026-08-13'; // Thursday

function option(key: string) {
  const found = findOption(key);
  if (!found) throw new Error(`missing option ${key}`);
  return found;
}

describe('court options', () => {
  it('exposes one tennis court, four pickleball courts and three basketball options', () => {
    expect(COURT_OPTIONS.map((entry) => entry.key)).toEqual([
      'tennis',
      'pb1',
      'pb2',
      'pb3',
      'pb4',
      'bbA',
      'bbB',
      'bbFull',
    ]);
  });

  it('maps each option to the resources it occupies', () => {
    expect(option('tennis').resources).toEqual(['T1', 'T2', 'T3', 'T4']);
    expect(option('pb2').resources).toEqual(['T2']);
    expect(option('bbA').resources).toEqual(['B1']);
    expect(option('bbFull').resources).toEqual(['B1', 'B2']);
  });

  it('validates option keys', () => {
    expect(isValidOptionKey('pb4')).toBe(true);
    expect(isValidOptionKey('pb5')).toBe(false);
    expect(isValidOptionKey('')).toBe(false);
    expect(findOption('nope')).toBeNull();
  });
});

describe('optionsConflict', () => {
  it('blocks tennis once any pickleball court is taken', () => {
    for (const key of ['pb1', 'pb2', 'pb3', 'pb4']) {
      expect(optionsConflict(option('tennis'), option(key))).toBe(true);
    }
  });

  it('lets separate pickleball courts coexist', () => {
    expect(optionsConflict(option('pb1'), option('pb2'))).toBe(false);
    expect(optionsConflict(option('pb3'), option('pb4'))).toBe(false);
  });

  it('blocks the full basketball court when either half is taken', () => {
    expect(optionsConflict(option('bbFull'), option('bbA'))).toBe(true);
    expect(optionsConflict(option('bbFull'), option('bbB'))).toBe(true);
    expect(optionsConflict(option('bbA'), option('bbB'))).toBe(false);
  });

  it('keeps the two surfaces independent', () => {
    expect(optionsConflict(option('tennis'), option('bbFull'))).toBe(false);
    expect(optionsConflict(option('pb1'), option('bbA'))).toBe(false);
  });

  it('conflicts with itself', () => {
    for (const entry of COURT_OPTIONS) {
      expect(optionsConflict(entry, entry)).toBe(true);
    }
  });
});

describe('isTennisDay', () => {
  it('follows the Mon/Wed/Fri/Sun rotation', () => {
    expect(isTennisDay('2026-08-10')).toBe(true); // Monday
    expect(isTennisDay('2026-08-11')).toBe(false); // Tuesday
    expect(isTennisDay('2026-08-12')).toBe(true); // Wednesday
    expect(isTennisDay('2026-08-13')).toBe(false); // Thursday
    expect(isTennisDay('2026-08-14')).toBe(true); // Friday
    expect(isTennisDay('2026-08-15')).toBe(false); // Saturday
    expect(isTennisDay('2026-08-16')).toBe(true); // Sunday
  });
});

describe('optionsFor', () => {
  it('follows the day rotation on the tennis court in the free morning', () => {
    const onTennisCourt = (date: string) =>
      optionsFor(date, 'free', DEFAULT_COURT_CONFIG)
        .filter((o) => o.venue === 'tennis-court')
        .map((o) => o.key);

    expect(onTennisCourt(TENNIS_DATE)).toEqual(['tennis']);
    expect(onTennisCourt(PICKLEBALL_DATE)).toEqual([
      'pb1',
      'pb2',
      'pb3',
      'pb4',
    ]);
  });

  it('opens the basketball court in the morning, but charges for it', () => {
    for (const date of [TENNIS_DATE, PICKLEBALL_DATE]) {
      const keys = optionsFor(date, 'free', DEFAULT_COURT_CONFIG).map(
        (o) => o.key,
      );
      expect(keys).toContain('bbA');
      expect(keys).toContain('bbFull');
    }

    expect(priceForOption(option('bbA'), 'free', DEFAULT_PRICING)).toBe(200);
    expect(priceForOption(option('bbFull'), 'free', DEFAULT_PRICING)).toBe(400);
  });

  it('offers pickleball and basketball in paid hours, every day', () => {
    for (const date of [TENNIS_DATE, PICKLEBALL_DATE]) {
      const keys = optionsFor(date, 'day', DEFAULT_COURT_CONFIG).map(
        (o) => o.key,
      );
      expect(keys).toEqual(['pb1', 'pb2', 'pb3', 'pb4', 'bbA', 'bbB', 'bbFull']);
    }
  });

  it('withholds paid tennis until the association sets a rate', () => {
    expect(
      optionsFor(TENNIS_DATE, 'night', DEFAULT_COURT_CONFIG).map((o) => o.key),
    ).not.toContain('tennis');

    expect(
      optionsFor(TENNIS_DATE, 'night', {
        ...DEFAULT_COURT_CONFIG,
        paidTennisEnabled: true,
      }).map((o) => o.key),
    ).toContain('tennis');
  });

  it('can drop basketball entirely', () => {
    const keys = optionsFor(TENNIS_DATE, 'day', {
      ...DEFAULT_COURT_CONFIG,
      basketballEnabled: false,
    }).map((o) => o.key);
    expect(keys).toEqual(['pb1', 'pb2', 'pb3', 'pb4']);
  });
});

describe('priceForOption', () => {
  it('charges nothing for the tennis court in the free morning', () => {
    expect(priceForOption(option('tennis'), 'free', DEFAULT_PRICING)).toBe(0);
    expect(priceForOption(option('pb1'), 'free', DEFAULT_PRICING)).toBe(0);
  });

  it('charges the pickleball rate per pickleball court', () => {
    expect(priceForOption(option('pb1'), 'day', DEFAULT_PRICING)).toBe(200);
    expect(priceForOption(option('pb4'), 'night', DEFAULT_PRICING)).toBe(350);
  });

  it('charges a basketball half court the same as a pickleball court', () => {
    expect(priceForOption(option('bbA'), 'day', DEFAULT_PRICING)).toBe(200);
    expect(priceForOption(option('bbB'), 'night', DEFAULT_PRICING)).toBe(350);
  });

  it('charges the full basketball court as two halves', () => {
    expect(priceForOption(option('bbFull'), 'day', DEFAULT_PRICING)).toBe(400);
    expect(priceForOption(option('bbFull'), 'night', DEFAULT_PRICING)).toBe(700);
  });

  it('charges the tennis rate for the whole tennis court, not four quarters', () => {
    expect(priceForOption(option('tennis'), 'day', DEFAULT_PRICING)).toBe(350);
    expect(priceForOption(option('tennis'), 'night', DEFAULT_PRICING)).toBe(400);
  });
});
