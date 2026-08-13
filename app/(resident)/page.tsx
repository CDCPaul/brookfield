import Link from 'next/link';

import { ClosureNotice } from '@/components/closure-notice';
import { NextBooking } from '@/components/next-booking';
import { Card } from '@/components/ui';
import type { Activity } from '@/lib/courts';
import { getActivityCounts } from '@/lib/queries/availability';
import { getClosures } from '@/lib/queries/closures';
import { getSettings } from '@/lib/queries/settings';
import { formatPeso } from '@/lib/schedule';
import { addDays, formatLongDate, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

const SPORTS: { activity: Activity; label: string; blurb: string }[] = [
  {
    activity: 'pickleball',
    label: 'Pickleball',
    blurb: 'Four courts on the tennis court',
  },
  { activity: 'tennis', label: 'Tennis', blurb: 'The whole tennis court' },
  {
    activity: 'basketball',
    label: 'Basketball',
    blurb: 'Half court or full court',
  },
];

export default async function TodayPage() {
  const now = new Date();
  const today = manilaNow(now).date;
  const { limits, pricing } = await getSettings();

  const [counts, closures] = await Promise.all([
    getActivityCounts(today, now),
    getClosures(today, addDays(today, limits.advanceDays)),
  ]);

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm text-muted">{formatLongDate(today)}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Book a court today
        </h1>
        <p className="mt-1 text-sm text-muted">
          Free 6:00 – 9:00 AM for residents ·{' '}
          {formatPeso(pricing.day.pickleball)}–
          {formatPeso(pricing.night.tennis)} per hour after that
        </p>
      </section>

      <NextBooking />

      <ClosureNotice closures={closures} />

      <section className="space-y-2">
        {SPORTS.map((sport) => {
          const open = counts[sport.activity];
          return (
            <Link
              key={sport.activity}
              href={`/book?sport=${sport.activity}`}
              className="flex items-center gap-3 rounded-2xl border border-edge bg-surface p-4 active:bg-background"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">
                  {sport.label}
                </span>
                <span className="block text-sm text-muted">{sport.blurb}</span>
              </span>
              <span className="shrink-0 text-right">
                <span
                  className={`block text-lg font-bold ${
                    open === 0 ? 'text-muted' : 'text-court'
                  }`}
                >
                  {open}
                </span>
                <span className="block text-[11px] text-muted">open today</span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-muted">
                ›
              </span>
            </Link>
          );
        })}
      </section>

      <Card>
        <h2 className="text-sm font-semibold">Good to know</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted">
          <li>
            The tennis court doubles as four pickleball courts, so booking
            either one uses it up
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
      </Card>
    </div>
  );
}
