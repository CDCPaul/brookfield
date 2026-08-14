import { GuestBadge, bookerLabel, courtLabel } from '@/components/booker-label';
import { PaymentBadge } from '@/components/booking-status';
import { RequestActions } from '@/components/admin/request-actions';
import { Notice, SectionTitle } from '@/components/ui';
import {
  getPendingBookings,
  getRecentDecisions,
} from '@/lib/queries/bookings';
import { formatPeso, getSlot, tierLabel, type Tier } from '@/lib/schedule';
import { formatLongDate, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  const today = manilaNow().date;
  const [pending, decided] = await Promise.all([
    getPendingBookings(today),
    getRecentDecisions(12),
  ]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold tracking-tight">Requests</h1>
        <p className="mt-1 text-sm text-muted">
          Bookings hold their slot while they wait here, so decline anything you
          are not going to approve.
        </p>
      </section>

      <section>
        <SectionTitle>Waiting for approval ({pending.length})</SectionTitle>
        {pending.length === 0 ? (
          <Notice>Nothing waiting. All caught up.</Notice>
        ) : (
          <ul className="space-y-3">
            {pending.map((booking) => {
              const slot = getSlot(booking.slotIndex);
              const unit = bookerLabel(booking);

              return (
                <li
                  key={booking.id}
                  className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-950/25"
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
                        {formatLongDate(booking.bookingDate)}
                      </p>
                      <p className="text-xs text-muted">{slot.label}</p>
                      <p className="text-xs text-muted">
                        {courtLabel(booking)} · {tierLabel(booking.tier as Tier)}
                      </p>
                    </div>
                  </div>

                  {booking.amount > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PaymentBadge
                        paymentStatus={booking.paymentStatus}
                        amount={booking.amount}
                      />
                      {booking.paymentRef ? (
                        <span className="text-xs text-muted">
                          GCash ref{' '}
                          <span className="font-mono">{booking.paymentRef}</span>
                        </span>
                      ) : null}
                      {booking.paymentProofUrl ? (
                        <a
                          href={`/admin/proof/${booking.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium underline"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/admin/proof/${booking.id}`}
                            alt=""
                            className="size-10 rounded border border-edge object-cover"
                          />
                          View receipt
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  <RequestActions
                    bookingId={booking.id}
                    amount={booking.amount}
                    alreadyPaid={booking.paymentStatus === 'paid'}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {decided.length > 0 ? (
        <section>
          <SectionTitle>Recently decided</SectionTitle>
          <ul className="space-y-1.5">
            {decided.map((booking) => (
              <li
                key={booking.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-edge px-3 py-2 text-xs"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{booking.bookerName}</span>
                  <span className="text-muted">
                    {' '}
                    · {formatLongDate(booking.bookingDate)},{' '}
                    {getSlot(booking.slotIndex).label}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-semibold ${
                    booking.status === 'confirmed' ? 'text-court' : 'text-red-600'
                  }`}
                >
                  {booking.status === 'confirmed'
                    ? booking.amount > 0
                      ? `Approved · ${formatPeso(booking.amount)}`
                      : 'Approved'
                    : 'Declined'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
