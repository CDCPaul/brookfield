import { DateStrip } from '@/components/date-strip';
import { SlotPicker } from '@/components/slot-picker';
import { SportTabs } from '@/components/sport-tabs';
import { Notice } from '@/components/ui';
import { type Activity, isTennisDay } from '@/lib/courts';
import {
  getActivityCounts,
  getCalendarStrip,
  getDayAvailability,
} from '@/lib/queries/availability';
import { getSettings } from '@/lib/queries/settings';
import { formatLongDate, isValidDateStr, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

const ACTIVITIES: Activity[] = ['pickleball', 'tennis', 'basketball'];

function parseActivity(value: string | undefined): Activity {
  return ACTIVITIES.includes(value as Activity)
    ? (value as Activity)
    : 'pickleball';
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sport?: string }>;
}) {
  const now = new Date();
  const today = manilaNow(now).date;
  const params = await searchParams;
  const activity = parseActivity(params.sport);

  const strip = await getCalendarStrip(activity, now);
  const selected =
    params.date &&
    isValidDateStr(params.date) &&
    strip.some((entry) => entry.date === params.date)
      ? params.date
      : today;

  const [day, counts, { schedule }] = await Promise.all([
    getDayAvailability(selected, activity, now),
    getActivityCounts(selected, now),
    getSettings(),
  ]);

  const hasFreeBlock = day.groups.some((group) => group.tier === 'free');

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Book a court</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a sport and a day, then choose a time.
        </p>
      </section>

      <SportTabs
        active={activity}
        counts={counts}
        date={selected}
        basePath="/book"
      />

      <DateStrip days={strip} selected={selected} activity={activity} />

      <p className="text-sm font-semibold">{formatLongDate(selected)}</p>

      {!hasFreeBlock && activity !== 'basketball' ? (
        <Notice>
          {isTennisDay(selected)
            ? 'The free morning is tennis today.'
            : 'The free morning is pickleball today.'}{' '}
          Paid hours start at {formatHour(schedule.freeUntilHour)}.
        </Notice>
      ) : null}

      {!hasFreeBlock && activity === 'basketball' ? (
        <Notice>
          The basketball court is paid from {formatHour(6)}. The free morning
          covers the tennis court only.
        </Notice>
      ) : null}

      <SlotPicker day={day} activity={activity} />
    </div>
  );
}

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00 ${suffix}`;
}

