import { DateStrip } from '@/components/date-strip';
import { SlotList } from '@/components/slot-list';
import { PrimaryLink, SportBadge } from '@/components/ui';
import { getCalendarStrip, getDayAvailability } from '@/lib/queries/availability';
import { sportLabel } from '@/lib/schedule';
import { addDays, formatLongDate, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const now = new Date();
  const today = manilaNow(now).date;

  const [day, strip] = await Promise.all([
    getDayAvailability(today, now),
    getCalendarStrip(now),
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
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {sportLabel(day.sport)} today
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          Free for residents, 6:00 – 9:00 AM
        </p>
      </section>

      {morningIsOver ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-edge bg-surface p-5 text-center">
            <p className="text-base font-semibold">Today&apos;s free hours are over</p>
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
    </div>
  );
}
