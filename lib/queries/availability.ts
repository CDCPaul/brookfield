import type { Activity } from '@/lib/courts';
import {
  type DayAvailability,
  bookableDates,
  computeDayAvailability,
} from '@/lib/rules';
import { manilaNow, type DateStr } from '@/lib/time';

import { getHeldResources } from './bookings';
import { getClosures } from './closures';
import { getSettings } from './settings';

export async function getDayAvailability(
  date: DateStr,
  activity?: Activity,
  now: Date = new Date(),
): Promise<DayAvailability> {
  const moment = manilaNow(now);
  const { limits, schedule, pricing, courts } = await getSettings();
  const [closures, held] = await Promise.all([
    getClosures(date, date),
    getHeldResources(date, date),
  ]);

  return computeDayAvailability({
    date,
    now: moment,
    limits,
    schedule,
    pricing,
    courts,
    closures,
    held,
    activity,
  });
}

export type DaySummary = {
  date: DateStr;
  openCount: number;
  capacity: number;
  isToday: boolean;
  /** Every slot on offer has already started. */
  allPast: boolean;
};

/** One entry per bookable date, for the horizontal date picker. */
export async function getCalendarStrip(
  activity?: Activity,
  now: Date = new Date(),
): Promise<DaySummary[]> {
  const moment = manilaNow(now);
  const { limits, schedule, pricing, courts } = await getSettings();
  const dates = bookableDates(moment, limits);

  const [closures, held] = await Promise.all([
    getClosures(dates[0], dates[dates.length - 1]),
    getHeldResources(dates[0], dates[dates.length - 1]),
  ]);

  return dates.map((date) => {
    const day = computeDayAvailability({
      date,
      now: moment,
      limits,
      schedule,
      pricing,
      courts,
      closures,
      held,
      activity,
    });

    return {
      date,
      openCount: day.openCount,
      capacity: day.capacity,
      isToday: date === moment.date,
      // Guard on capacity: with no slots at all, `every` is vacuously true and
      // a sport that simply is not offered would read as 'the hours have gone'.
      allPast:
        day.capacity > 0 &&
        day.groups.every((group) =>
          group.slots.every((slot) =>
            slot.options.every((option) => option.status === 'past'),
          ),
        ),
    };
  });
}

/** Open counts per activity for the sport tabs. */
export async function getActivityCounts(
  date: DateStr,
  now: Date = new Date(),
): Promise<Record<Activity, number>> {
  const moment = manilaNow(now);
  const { limits, schedule, pricing, courts } = await getSettings();
  const [closures, held] = await Promise.all([
    getClosures(date, date),
    getHeldResources(date, date),
  ]);

  const count = (activity: Activity) =>
    computeDayAvailability({
      date,
      now: moment,
      limits,
      schedule,
      pricing,
      courts,
      closures,
      held,
      activity,
    }).openCount;

  return {
    tennis: count('tennis'),
    pickleball: count('pickleball'),
    basketball: count('basketball'),
  };
}
