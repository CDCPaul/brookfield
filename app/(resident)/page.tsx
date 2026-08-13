import Link from 'next/link';

import { ClosureNotice } from '@/components/closure-notice';
import { DateStrip } from '@/components/date-strip';
import { NextBooking } from '@/components/next-booking';
import { SlotList } from '@/components/slot-list';
import { PrimaryLink, SportBadge } from '@/components/ui';
import { getCalendarStrip, getDayAvailability } from '@/lib/queries/availability';
import { getClosures } from '@/lib/queries/closures';
import { getLimits } from '@/lib/queries/settings';
import { sportLabel } from '@/lib/schedule';
import { addDays, formatLongDate, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const now = new Date();
  const today = manilaNow(now).date;
  const limits = await getLimits();

  const [day, strip, closures] = await Promise.all([
    getDayAvailability(today, now),
    getCalendarStrip(now),
    getClosures(today, addDays(today, limits.advanceDays)),
  ]);

  const morningIsOver = day.slots.every((slot) =>
    slot.courts.every((court) => court.status === 'past'),
  );

  const tomorrow = addDays(today, 1);
  const tomorrowSummary = strip.find((entry) => entry.date === tomorrow);

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm text-muted">{formatLongDate(today)}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {sportLabel(day.sport)} today
        </h1>
        <p className="mt-1 text-sm text-muted">
          Free for residents, 6:00 – 9:00 AM
        </p>
      </section>

      <NextBooking />

      <ClosureNotice closures={closures} />

      {morningIsOver ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-edge bg-surface p-5 text-center">
            <p className="text-base font-semibold">
              Today&apos;s free hours are over
            </p>
            <p className="mt-1 text-sm text-muted">
              The courts open again tomorrow at 6:00 AM.
            </p>
          </div>

          {tomorrowSummary ? (
            <div className="rounded-2xl border border-edge bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Tomorrow</p>
                  <p className="text-xs text-muted">{formatLongDate(tomorrow)}</p>
                </div>
                <SportBadge sport={tomorrowSummary.sport} />
              </div>
              <p className="mt-3 text-sm text-muted">
                {tomorrowSummary.openCount} of {tomorrowSummary.capacity} places
                still open.
              </p>
              <div className="mt-3">
                <PrimaryLink href={`/book?date=${tomorrow}`}>
                  Book for tomorrow
                </PrimaryLink>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <section className="flex items-center justify-between rounded-2xl border border-edge bg-surface px-4 py-3">
            <SportBadge sport={day.sport} />
            <p className="text-sm font-medium">
              <span className="text-court">{day.openCount}</span>
              <span className="text-muted"> of {day.capacity} open</span>
            </p>
          </section>

          <section>
            <SlotList day={day} />
          </section>
        </>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Next 7 days
        </h2>
        <DateStrip days={strip} selected={today} />
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-4">
        <h2 className="text-sm font-semibold">Good to know</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted">
          <li>🎾 Tennis on Mon, Wed, Fri and Sun · 🏓 Pickleball on Tue, Thu and Sat</li>
          {limits.enabled ? (
            <li>
              {limits.maxPerDay} booking per household per day,{' '}
              {limits.maxPerWeek} per week
            </li>
          ) : null}
          <li>Cancel early if you cannot make it — someone else can take it</li>
        </ul>
        <Link
          href="/rules"
          className="mt-3 inline-block text-sm font-medium text-court underline"
        >
          Read the full rules
        </Link>
      </section>
    </div>
  );
}
