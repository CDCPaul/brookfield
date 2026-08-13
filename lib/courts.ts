/**
 * What can be booked, and what each booking physically occupies.
 *
 * Brookfield has two playing surfaces, each of which is subdivided:
 *
 *   Tennis court   → four pickleball courts (T1–T4)
 *   Basketball court → two half courts (B1, B2)
 *
 * A booking takes a *set* of these resources. Playing tennis uses the whole
 * tennis court, so it occupies all four quarters; booking a single pickleball
 * court occupies one. That is why one pickleball booking blocks tennis for
 * that hour, and why two people holding separate half courts means nobody can
 * book the full court.
 *
 * Conflicts are therefore decided by overlapping resource sets, not by court
 * numbers.
 */

import type { Pricing, Tier } from './schedule';
import { type DateStr, dayOfWeek } from './time';

/** An indivisible piece of a playing surface. */
export type ResourceKey = 'T1' | 'T2' | 'T3' | 'T4' | 'B1' | 'B2';

export type Activity = 'tennis' | 'pickleball' | 'basketball';

export type Venue = 'tennis-court' | 'basketball-court';

export type CourtOption = {
  /** Stored on the booking; stable across renames. */
  key: string;
  venue: Venue;
  activity: Activity;
  /** Full name, e.g. 'Pickleball court 2'. */
  label: string;
  /** Compact name for tight spaces, e.g. 'Court 2'. */
  short: string;
  resources: ResourceKey[];
};

const TENNIS_QUARTERS: ResourceKey[] = ['T1', 'T2', 'T3', 'T4'];

export const COURT_OPTIONS: readonly CourtOption[] = [
  {
    key: 'tennis',
    venue: 'tennis-court',
    activity: 'tennis',
    label: 'Tennis court',
    short: 'Tennis',
    resources: TENNIS_QUARTERS,
  },
  ...TENNIS_QUARTERS.map((resource, index) => ({
    key: `pb${index + 1}`,
    venue: 'tennis-court' as const,
    activity: 'pickleball' as const,
    label: `Pickleball court ${index + 1}`,
    short: `Court ${index + 1}`,
    resources: [resource],
  })),
  {
    key: 'bbA',
    venue: 'basketball-court',
    activity: 'basketball',
    label: 'Basketball half court A',
    short: 'Half A',
    resources: ['B1'],
  },
  {
    key: 'bbB',
    venue: 'basketball-court',
    activity: 'basketball',
    label: 'Basketball half court B',
    short: 'Half B',
    resources: ['B2'],
  },
  {
    key: 'bbFull',
    venue: 'basketball-court',
    activity: 'basketball',
    label: 'Basketball full court',
    short: 'Full court',
    resources: ['B1', 'B2'],
  },
];

const BY_KEY = new Map(COURT_OPTIONS.map((option) => [option.key, option]));

export function findOption(key: string): CourtOption | null {
  return BY_KEY.get(key) ?? null;
}

export function isValidOptionKey(key: string): boolean {
  return BY_KEY.has(key);
}

// 0 = Sunday ... 6 = Saturday. The rotation decides how the tennis court is
// set up that day, which is what the free morning offers.
const TENNIS_DAYS = new Set([0, 1, 3, 5]); // Sun, Mon, Wed, Fri

export function isTennisDay(date: DateStr): boolean {
  return TENNIS_DAYS.has(dayOfWeek(date));
}

export type CourtConfig = {
  /**
   * Whether the tennis court can be booked as tennis during paid hours.
   * The published rate card only covers pickleball, so this stays off until
   * the association sets a tennis rate.
   */
  paidTennisEnabled: boolean;
  /** Whether the basketball court is bookable at all. */
  basketballEnabled: boolean;
};

export const DEFAULT_COURT_CONFIG: CourtConfig = {
  paidTennisEnabled: false,
  basketballEnabled: true,
};

/**
 * The options on offer for a given date and tier.
 *
 * The free morning is the association's resident benefit and covers the tennis
 * court only — set up for tennis or for pickleball depending on the day.
 */
export function optionsFor(
  date: DateStr,
  tier: Tier,
  config: CourtConfig,
): CourtOption[] {
  if (tier === 'free') {
    return COURT_OPTIONS.filter((option) =>
      isTennisDay(date)
        ? option.key === 'tennis'
        : option.venue === 'tennis-court' && option.activity === 'pickleball',
    );
  }

  return COURT_OPTIONS.filter((option) => {
    if (option.venue === 'basketball-court') return config.basketballEnabled;
    if (option.activity === 'tennis') return config.paidTennisEnabled;
    return true;
  });
}

/**
 * Pesos for one hour of this option.
 *
 * A basketball half court costs the same as a pickleball court, so the full
 * court — being two halves — costs twice that.
 */
export function priceForOption(
  option: CourtOption,
  tier: Tier,
  pricing: Pricing,
): number {
  if (tier === 'free') return 0;
  const rates = pricing[tier];

  if (option.activity === 'tennis') return rates.tennis;
  if (option.activity === 'pickleball') return rates.pickleball;
  return rates.pickleball * option.resources.length;
}

/** True when the two options cannot both be held at the same time. */
export function optionsConflict(a: CourtOption, b: CourtOption): boolean {
  return a.resources.some((resource) => b.resources.includes(resource));
}

const ACTIVITY_LABELS: Record<Activity, string> = {
  tennis: 'Tennis',
  pickleball: 'Pickleball',
  basketball: 'Basketball',
};

export function activityLabel(activity: Activity): string {
  return ACTIVITY_LABELS[activity];
}
