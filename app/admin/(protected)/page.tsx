import { BookingActions } from '@/components/admin/booking-actions';
import { DateNav } from '@/components/admin/date-nav';
import { Notice, SportBadge } from '@/components/ui';
import { getBookingsForDate } from '@/lib/queries/bookings';
import { getClosures } from '@/lib/queries/closures';
import { findClosure } from '@/lib/rules';
import { SLOTS, courtNumbers, sportForDate, sportLabel } from '@/lib/schedule';
import { isValidDateStr, manilaNow } from '@/lib/time';
import { formatUnitLabel } from '@/lib/unit-key';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  booked: 'border-court bg-court-soft dark:bg-court/15',
  cancelled: 'border-edge bg-background opacity-60',
  no_show: 'border-orange-300 bg-orange-50 dark:bg-orange-950/30',
};

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const today = manilaNow().date;
  const date =
    params.date && isValidDateStr(params.date) ? params.date : today;

  const sport = sportForDate(date);
  const courts = courtNumbers(sport);

  const [bookings, closures] = await Promise.all([
    getBookingsForDate(date),
    getClosures(date, date),
  ]);

  const active = bookings.filter((booking) => booking.status !== 'cancelled');
  const cancelled = bookings.filter((booking) => booking.status === 'cancelled');

  return (
    <div className="space-y-5">
      <DateNav date={date} basePath="/admin" />

      <div className="flex items-center justify-between rounded-xl border border-edge bg-surface px-4 py-3">
        <SportBadge sport={sport} />
        <p className="text-sm">
          <span className="font-semibold">{active.length}</span>
          <span className="text-muted">
            {' '}
            of {courts.length * SLOTS.length} booked
          </span>
        </p>
      </div>

      <div className="space-y-4">
        {SLOTS.map((slot) => (
          <section key={slot.index}>
            <h2 className="mb-2 text-sm font-semibold">{slot.label}</h2>
            <ul className="space-y-2">
              {courts.map((courtNo) => {
                const booking = active.find(
                  (item) =>
                    item.slotIndex === slot.index && item.courtNo === courtNo,
                );
                const closure = findClosure(closures, date, slot.index, courtNo);

                return (
                  <li
                    key={courtNo}
                    className={`rounded-xl border p-3 ${
                      booking
                        ? STATUS_STYLES[booking.status]
                        : closure
                          ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/30'
                          : 'border-edge bg-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="shrink-0 text-xs font-semibold text-muted">
                        {sport === 'tennis' ? 'Court' : `Court ${courtNo}`}
                      </span>

                      {booking ? (
                        <div className="flex-1 text-right">
                          <p className="text-sm font-semibold">
                            {booking.bookerName}
                          </p>
                          <p className="text-xs text-muted">
                            {formatUnitLabel({
                              phase: booking.unitPhase,
                              block: booking.unitBlock,
                              lot: booking.unitLot,
                            })}
                          </p>
                          <p className="text-xs">
                            <a
                              href={`tel:${booking.phone}`}
                              className="font-medium underline"
                            >
                              {booking.phone}
                            </a>
                            <span className="text-muted">
                              {' '}
                              · {booking.code}
                            </span>
                          </p>
                          {booking.status === 'no_show' ? (
                            <p className="mt-1 text-xs font-semibold text-clay">
                              Marked no-show
                            </p>
                          ) : null}
                        </div>
                      ) : closure ? (
                        <p className="flex-1 text-right text-sm text-clay">
                          Closed — {closure.reason}
                        </p>
                      ) : (
                        <p className="flex-1 text-right text-sm text-muted">
                          Open
                        </p>
                      )}
                    </div>

                    {booking && booking.status === 'booked' ? (
                      <BookingActions bookingId={booking.id} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {cancelled.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">
            Cancelled ({cancelled.length})
          </h2>
          <ul className="space-y-1.5">
            {cancelled.map((booking) => (
              <li
                key={booking.id}
                className="rounded-lg border border-edge px-3 py-2 text-xs text-muted"
              >
                {SLOTS[booking.slotIndex].label} · Court {booking.courtNo} ·{' '}
                {booking.bookerName}
                {booking.cancelledBy ? ` (by ${booking.cancelledBy})` : ''}
                {booking.cancelReason ? ` — ${booking.cancelReason}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {active.length === 0 && cancelled.length === 0 ? (
        <Notice>No bookings for {sportLabel(sport).toLowerCase()} on this day.</Notice>
      ) : null}
    </div>
  );
}
