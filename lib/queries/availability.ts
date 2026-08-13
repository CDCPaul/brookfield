import {
  type DayAvailability,
  bookableDates,
  computeDayAvailability,
} from '@/lib/rules';
import { type Sport, sportForDate } from '@/lib/schedule';
import { manilaNow, type DateStr } from '@/lib/time';

import { getActiveBookings } from './bookings';
import { getClosures } from './closures';
import { getLimits } from './settings';

export async function getDayAvailability(
  date: DateStr,
  now: Date = new Date(),
): Promise<DayAvailability> {
  const moment = manilaNow(now);
  const limits = await getLimits();
  const [closures, taken] = await Promise.all([
    getClosures(date, date),
    getActiveBookings(date, date),
  ]);

  return computeDayAvailability({ date, now: moment, limits, closures, taken });
}

export type DaySummary = {
  date: DateStr;
  sport: Sport;
  openCount: number;
  capacity: number;
  isToday: boolean;
  /** Every slot has already started — 'over', not 'fully booked'. */
  allPast: boolean;
};

/** One entry per bookable date, for the horizontal date picker. */
export async function getCalendarStrip(
  now: Date = new Date(),
): Promise<DaySummary[]> {
  const moment = manilaNow(now);
  const limits = await getLimits();
  const dates = bookableDates(moment, limits);
  const from = dates[0];
  const to = dates[dates.length - 1];

  const [closures, taken] = await Promise.all([
    getClosures(from, to),
    getActiveBookings(from, to),
  ]);

  return dates.map((date) => {
    const day = computeDayAvailability({
      date,
      now: moment,
      limits,
      closures,
      taken,
    });
    return {
      date,
      sport: sportForDate(date),
      openCount: day.openCount,
      capacity: day.capacity,
      isToday: date === moment.date,
      allPast: day.slots.every((slot) =>
        slot.courts.every((court) => court.status === 'past'),
      ),
    };
  });
}
