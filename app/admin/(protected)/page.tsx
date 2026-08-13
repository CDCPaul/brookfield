import { BookingActions } from '@/components/admin/booking-actions';
import { DateNav } from '@/components/admin/date-nav';
import { GuestBadge, bookerLabel, courtLabel } from '@/components/booker-label';
import { PaymentBadge, StatusBadge } from '@/components/booking-status';
import { Notice, SportBadge } from '@/components/ui';
import { getBookingsForDate } from '@/lib/queries/bookings';
import { getClosures } from '@/lib/queries/closures';
import { getSettings } from '@/lib/queries/settings';
import {
  type Tier,
  formatPeso,
  getSlot,
  openSlots,
  sportForDate,
  tierLabel,
  tierRangeLabel,
} from '@/lib/schedule';
import { isValidDateStr, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

const TIER_ORDER: Tier[] = ['free', 'day', 'night'];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const today = manilaNow().date;
  const date = params.date && isValidDateStr(params.date) ? params.date : today;

  const sport = sportForDate(date);
  const [bookings, closures, { schedule }] = await Promise.all([
    getBookingsForDate(date),
    getClosures(date, date),
    getSettings(),
  ]);

  const live = bookings.filter((booking) =>
    ['pending', 'confirmed', 'no_show'].includes(booking.status),
  );
  const closed = bookings.filter((booking) =>
    ['cancelled', 'rejected'].includes(booking.status),
  );

  const capacity = openSlots(schedule).length * (sport === 'tennis' ? 1 : 4);
  const revenue = live
    .filter((booking) => booking.status !== 'no_show')
    .reduce((total, booking) => total + booking.amount, 0);

  return (
    <div className="space-y-5">
      <DateNav date={date} basePath="/admin" />

      <div className="flex items-center justify-between rounded-xl border border-edge bg-surface px-4 py-3">
        <SportBadge sport={sport} />
        <p className="text-right text-sm">
          <span className="font-semibold">{live.length}</span>
          <span className="text-muted"> of {capacity} booked</span>
          {revenue > 0 ? (
            <span className="block text-xs text-muted">
              {formatPeso(revenue)} billed
            </span>
          ) : null}
        </p>
      </div>

      {closures.length > 0 ? (
        <div className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm dark:border-orange-900 dark:bg-orange-950/30">
          <p className="font-semibold text-clay">Closures today</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted">
            {closures.map((closure, index) => (
              <li key={index}>
                {closure.reason} ·{' '}
                {closure.slotIndex === null
                  ? 'all slots'
                  : getSlot(closure.slotIndex).label}{' '}
                ·{' '}
                {closure.venue === null ? 'all courts' : closure.venue}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {live.length === 0 ? (
        <Notice>No bookings on this day.</Notice>
      ) : (
        TIER_ORDER.map((tier) => {
          const inTier = live.filter((booking) => booking.tier === tier);
          if (inTier.length === 0) return null;

          return (
            <section key={tier}>
              <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold">
                {tierLabel(tier)}
                <span className="text-xs font-normal text-muted">
                  {tierRangeLabel(tier, schedule)}
                </span>
              </h2>

              <ul className="space-y-2">
                {inTier.map((booking) => {
                  const unit = bookerLabel(booking);
                  return (
                    <li
                      key={booking.id}
                      className="rounded-xl border border-edge bg-surface p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-sm font-semibold">
                            {booking.bookerType !== 'resident' ? (
                              <GuestBadge />
                            ) : null}
                            {booking.bookerName}
                          </p>
                          {unit ? (
                            <p className="text-xs text-muted">{unit}</p>
                          ) : null}
                          <p className="text-xs">
                            <a
                              href={`tel:${booking.phone}`}
                              className="font-medium underline"
                            >
                              {booking.phone}
                            </a>
                            <span className="text-muted"> · {booking.code}</span>
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold">
                            {getSlot(booking.slotIndex).label}
                          </p>
                          <p className="text-xs text-muted">
                            {courtLabel(booking)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusBadge status={booking.status} />
                        <PaymentBadge
                          paymentStatus={booking.paymentStatus}
                          amount={booking.amount}
                        />
                      </div>

                      {booking.status !== 'no_show' ? (
                        <BookingActions
                          bookingId={booking.id}
                          showMarkPaid={
                            booking.amount > 0 &&
                            booking.paymentStatus !== 'paid'
                          }
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {closed.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">
            Cancelled and declined ({closed.length})
          </h2>
          <ul className="space-y-1.5">
            {closed.map((booking) => (
              <li
                key={booking.id}
                className="rounded-lg border border-edge px-3 py-2 text-xs text-muted"
              >
                {getSlot(booking.slotIndex).label} · Court {booking.courtNo} ·{' '}
                {booking.bookerName}
                {booking.cancelledBy ? ` (by ${booking.cancelledBy})` : ''}
                {booking.cancelReason ? ` — ${booking.cancelReason}` : ''}
                {booking.decisionNote ? ` — ${booking.decisionNote}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
