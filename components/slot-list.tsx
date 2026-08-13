import Link from 'next/link';

import type { DayAvailability, SlotAvailability, TierGroup } from '@/lib/rules';
import { formatPeso } from '@/lib/schedule';

const STATUS_LABEL = {
  taken: 'Taken',
  closed: 'Closed',
  past: 'Passed',
  open: 'Open',
} as const;

export function SlotList({ day }: { day: DayAvailability }) {
  return (
    <div className="space-y-6">
      {day.groups.map((group) => (
        <TierSection key={group.tier} day={day} group={group} />
      ))}
    </div>
  );
}

function TierSection({
  day,
  group,
}: {
  day: DayAvailability;
  group: TierGroup;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{group.label}</h2>
          <p className="text-xs text-muted">{group.rangeLabel}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            group.tier === 'free'
              ? 'bg-court-soft text-court-dark dark:bg-court/20 dark:text-court-soft'
              : 'bg-orange-100 text-clay dark:bg-orange-950/50'
          }`}
        >
          {group.tier === 'free'
            ? 'Free for residents'
            : `${formatPeso(group.price)} / hour`}
        </span>
      </div>

      {group.openCount === 0 ? (
        <p className="rounded-xl border border-edge bg-background px-4 py-3 text-center text-sm text-muted">
          Nothing open in this block.
        </p>
      ) : (
        <ul className="space-y-2">
          {group.slots.map((slot) => (
            <SlotRow key={slot.slotIndex} date={day.date} slot={slot} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SlotRow({ date, slot }: { date: string; slot: SlotAvailability }) {
  const single = slot.courts.length === 1;
  const soleCourt = slot.courts[0];

  if (slot.openCount === 0) {
    return (
      <li className="flex items-center justify-between rounded-xl border border-edge bg-background px-4 py-3">
        <span className="text-sm text-muted">{slot.label}</span>
        <span className="text-xs font-medium text-muted">
          {describeUnavailable(slot.courts)}
        </span>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-edge bg-surface p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{slot.label}</h3>
        <span className="text-xs font-medium text-court">
          {slot.openCount} of {slot.courts.length} open
        </span>
      </div>

      {single ? (
        <div className="mt-2.5">
          {soleCourt.status === 'open' ? (
            <Link
              href={`/book/confirm?date=${date}&slot=${slot.slotIndex}&court=1`}
              className="inline-flex w-full items-center justify-center rounded-xl bg-court px-4 py-3 text-sm font-semibold text-white active:bg-court-dark"
            >
              {slot.price > 0
                ? `Request — ${formatPeso(slot.price)}`
                : 'Request this slot'}
            </Link>
          ) : (
            <p className="rounded-xl bg-background px-4 py-3 text-center text-sm text-muted">
              {soleCourt.status === 'closed'
                ? `Closed — ${soleCourt.reason}`
                : STATUS_LABEL[soleCourt.status]}
            </p>
          )}
        </div>
      ) : (
        <ul className="mt-2.5 grid grid-cols-4 gap-2">
          {slot.courts.map((court) =>
            court.status === 'open' ? (
              <li key={court.courtNo}>
                <Link
                  href={`/book/confirm?date=${date}&slot=${slot.slotIndex}&court=${court.courtNo}`}
                  aria-label={`Request court ${court.courtNo} at ${slot.label}`}
                  className="flex flex-col items-center rounded-xl border border-court bg-court-soft py-2.5 text-court-dark active:bg-court active:text-white dark:bg-court/15 dark:text-court-soft"
                >
                  <span className="text-xs font-medium">Court</span>
                  <span className="text-lg font-bold leading-tight">
                    {court.courtNo}
                  </span>
                </Link>
              </li>
            ) : (
              <li key={court.courtNo}>
                <div
                  title={court.reason}
                  className="flex flex-col items-center rounded-xl border border-edge bg-background py-2.5 text-muted"
                >
                  <span className="text-xs font-medium">Court</span>
                  <span className="text-lg font-bold leading-tight line-through decoration-1">
                    {court.courtNo}
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </li>
  );
}

function describeUnavailable(courts: SlotAvailability['courts']): string {
  if (courts.every((court) => court.status === 'past')) return 'Passed';
  if (courts.some((court) => court.status === 'closed')) return 'Closed';
  return 'Fully booked';
}
