import { notFound } from 'next/navigation';

import { PrimaryLink, SportBadge } from '@/components/ui';
import { isValidBookingCode, normalizeBookingCode } from '@/lib/booking-code';
import { getBookingByCode } from '@/lib/queries/bookings';
import { getSlot } from '@/lib/schedule';
import { bookerLabel } from '@/components/booker-label';
import { formatLongDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isValidBookingCode(code)) notFound();

  const booking = await getBookingByCode(normalizeBookingCode(code));
  if (!booking) notFound();

  const slot = getSlot(booking.slotIndex);
  const cancelled = booking.status === 'cancelled';

  return (
    <div className="space-y-5">
      <section className="text-center">
        <div
          className={`mx-auto grid size-14 place-items-center rounded-full ${
            cancelled ? 'bg-background text-muted' : 'bg-court text-white'
          }`}
          aria-hidden="true"
        >
          {cancelled ? (
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          {cancelled ? 'Booking cancelled' : "You're booked"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {cancelled
            ? 'This slot has been released.'
            : 'Please arrive a few minutes early.'}
        </p>
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">
              {formatLongDate(booking.bookingDate)}
            </p>
            <p className="text-sm text-muted">{slot.label}</p>
          </div>
          <SportBadge sport={booking.sport as 'tennis' | 'pickleball'} />
        </div>

        <dl className="mt-4 space-y-2 border-t border-edge pt-4 text-sm">
          <Row
            label="Court"
            value={
              booking.sport === 'tennis'
                ? 'Tennis court'
                : `Court ${booking.courtNo}`
            }
          />
          <Row label="Name" value={booking.bookerName} />
          <Row
            label={booking.bookerType === 'resident' ? 'Unit' : 'Booked as'}
            value={bookerLabel(booking) ?? 'Guest'}
          />
          <Row label="Mobile" value={booking.phone} />
          <Row label="Reference" value={booking.code} mono />
        </dl>
      </section>

      <div className="space-y-2">
        <PrimaryLink href="/my">View my bookings</PrimaryLink>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right font-medium ${mono ? 'font-mono tracking-widest' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
