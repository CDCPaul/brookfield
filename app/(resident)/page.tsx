import Link from 'next/link';

import { ClosureNotice } from '@/components/closure-notice';
import { DateStrip } from '@/components/date-strip';
import { NextBooking } from '@/components/next-booking';
import { SlotList } from '@/components/slot-list';
import { SportBadge } from '@/components/ui';
import { getCalendarStrip, getDayAvailability } from '@/lib/queries/availability';
import { getClosures } from '@/lib/queries/closures';
import { getSettings } from '@/lib/queries/settings';
import { formatPeso, sportLabel } from '@/lib/schedule';
import { addDays, formatLongDate, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const now = new Date();
  const today = manilaNow(now).date;
  const { limits, pricing } = await getSettings();

  const [day, strip, closures] = await Promise.all([
    getDayAvailability(today, now),
    getCalendarStrip(now),
    getClosures(today, addDays(today, limits.advanceDays)),
  ]);

  const dayIsOver = day.openCount === 0 && day.capacity > 0;
  const dayPrice = pricing.day[day.sport];
  const nightPrice = pricing.night[day.sport];

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm text-muted">{formatLongDate(today)}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {sportLabel(day.sport)} today
        </h1>
        <p className="mt-1 text-sm text-muted">
          Free 6:00 – 9:00 AM for residents · {formatPeso(dayPrice)}–
          {formatPeso(nightPrice)} per hour after that
        </p>
      </section>

      <NextBooking />

      <ClosureNotice closures={closures} />

      {dayIsOver ? (
        <section className="rounded-2xl border border-edge bg-surface p-5 text-center">
          <p className="text-base font-semibold">Nothing left today</p>
          <p className="mt-1 text-sm text-muted">
            Pick another day below to book.
          </p>
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

          <SlotList day={day} />
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
          <li>
            🎾 Tennis on Mon, Wed, Fri and Sun · 🏓 Pickleball on Tue, Thu and
            Sat
          </li>
          <li>Every booking is reviewed by the association before it is confirmed</li>
          {limits.enabled ? (
            <li>
              Free morning: {limits.maxPerDay} booking per household per day,{' '}
              {limits.maxPerWeek} per week
            </li>
          ) : null}
          <li>Water and sports drinks only — no other food or drink on court</li>
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
