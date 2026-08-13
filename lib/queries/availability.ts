import {
  type DayAvailability,
  bookableDates,
  computeDayAvailability,
} from '@/lib/rules';
import { type Sport, sportForDate } from '@/lib/schedule';
import { manilaNow, type DateStr } from '@/lib/time';

import { getActiveBookings } from './bookings';
import { getClosures } from './closures';
import { getSettings } from './settings';

export async function getDayAvailability(
  date: DateStr,
  now: Date = new Date(),
): Promise<DayAvailability> {
  const moment = manilaNow(now);
  const { limits, schedule, pricing } = await getSettings();
  const [closures, taken] = await Promise.all([
    getClosures(date, date),
    getActiveBookings(date, date),
  ]);

  return computeDayAvailability({
    date,
    now: moment,
    limits,
    schedule,
    pricing,
    closures,
    taken,
  });
}

export type DaySummary = {
  date: DateStr;
  sport: Sport;
  openCount: number;
  capacity: number;
  /** Open places in the free morning only — what most residents care about. */
  freeOpenCount: number;
  isToday: boolean;
  /** Every slot has already started — 'over', not 'fully booked'. */
  allPast: boolean;
};

/** One entry per bookable date, for the horizontal date picker. */
export async function getCalendarStrip(
  now: Date = new Date(),
): Promise<DaySummary[]> {
  const moment = manilaNow(now);
  const { limits, schedule, pricing } = await getSettings();
  const dates = bookableDates(moment, limits);

  const [closures, taken] = await Promise.all([
    getClosures(dates[0], dates[dates.length - 1]),
    getActiveBookings(dates[0], dates[dates.length - 1]),
  ]);

  return dates.map((date) => {
    const day = computeDayAvailability({
      date,
      now: moment,
      limits,
      schedule,
      pricing,
      closures,
      taken,
    });

    return {
      date,
      sport: sportForDate(date),
      openCount: day.openCount,
      capacity: day.capacity,
      freeOpenCount:
        day.groups.find((group) => group.tier === 'free')?.openCount ?? 0,
      isToday: date === moment.date,
      allPast: day.groups.every((group) =>
        group.slots.every((slot) =>
          slot.courts.every((court) => court.status === 'past'),
        ),
      ),
    };
  });
}
