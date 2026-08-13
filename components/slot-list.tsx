import Link from 'next/link';

import type { DayAvailability } from '@/lib/rules';

const STATUS_LABEL = {
  taken: 'Taken',
  closed: 'Closed',
  past: 'Passed',
  open: 'Open',
} as const;

export function SlotList({ day }: { day: DayAvailability }) {
  return (
    <ul className="space-y-3">
      {day.slots.map((slot) => {
        const single = slot.courts.length === 1;
        const soleCourt = slot.courts[0];
        const slotUnavailable = slot.openCount === 0;

        return (
          <li
            key={slot.slotIndex}
            className="rounded-2xl border border-edge bg-surface p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold">{slot.label}</h3>
              <span
                className={`text-xs font-medium ${
                  slotUnavailable ? 'text-muted' : 'text-court'
                }`}
              >
                {slotUnavailable
                  ? describeUnavailable(slot.courts)
                  : `${slot.openCount} of ${slot.courts.length} open`}
              </span>
            </div>

            {single ? (
              <div className="mt-3">
                {soleCourt.status === 'open' ? (
                  <Link
                    href={`/book/confirm?date=${day.date}&slot=${slot.slotIndex}&court=1`}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-court px-4 py-3 text-sm font-semibold text-white active:bg-court-dark"
                  >
                    Book this slot
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
              <ul className="mt-3 grid grid-cols-4 gap-2">
                {slot.courts.map((court) => {
                  const label = `Court ${court.courtNo}`;
                  if (court.status === 'open') {
                    return (
                      <li key={court.courtNo}>
                        <Link
                          href={`/book/confirm?date=${day.date}&slot=${slot.slotIndex}&court=${court.courtNo}`}
                          aria-label={`Book ${label} at ${slot.label}`}
                          className="flex flex-col items-center rounded-xl border border-court bg-court-soft py-2.5 text-court-dark active:bg-court active:text-white dark:bg-court/15 dark:text-court-soft"
                        >
                          <span className="text-xs font-medium">Court</span>
                          <span className="text-lg font-bold leading-tight">
                            {court.courtNo}
                          </span>
                        </Link>
                      </li>
                    );
                  }
                  return (
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
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function describeUnavailable(
  courts: DayAvailability['slots'][number]['courts'],
): string {
  if (courts.every((court) => court.status === 'past')) return 'Passed';
  if (courts.some((court) => court.status === 'closed')) return 'Closed';
  return 'Fully booked';
}
