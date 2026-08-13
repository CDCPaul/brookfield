import { DateStrip } from '@/components/date-strip';
import { SlotList } from '@/components/slot-list';
import { Notice, SportBadge } from '@/components/ui';
import { getCalendarStrip, getDayAvailability } from '@/lib/queries/availability';
import { formatLongDate, isValidDateStr, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const now = new Date();
  const today = manilaNow(now).date;
  const params = await searchParams;

  const strip = await getCalendarStrip(now);
  const requested = params.date;
  const selected =
    requested && isValidDateStr(requested) && strip.some((d) => d.date === requested)
      ? requested
      : today;

  const day = await getDayAvailability(selected, now);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Book a slot</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a day, then choose an open time.
        </p>
      </section>

      <DateStrip days={strip} selected={selected} />

      <section className="flex items-center justify-between rounded-2xl border border-edge bg-surface px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{formatLongDate(selected)}</p>
          <p className="text-xs text-muted">
            {day.openCount} of {day.capacity} open
          </p>
        </div>
        <SportBadge sport={day.sport} />
      </section>

      {day.openCount === 0 ? (
        <Notice>
          No open places left on this day. Try another date.
        </Notice>
      ) : null}

      <SlotList day={day} />
    </div>
  );
}
