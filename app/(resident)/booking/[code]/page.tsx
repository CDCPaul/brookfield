import { notFound } from 'next/navigation';

import { bookerLabel } from '@/components/booker-label';
import { PaymentBadge, StatusBadge } from '@/components/booking-status';
import { PaymentInstructions } from '@/components/payment-instructions';
import { PrimaryLink, SportBadge } from '@/components/ui';
import { isValidBookingCode, normalizeBookingCode } from '@/lib/booking-code';
import { getBookingByCode } from '@/lib/queries/bookings';
import { isPaymentConfigured } from '@/lib/payment';
import { getSettings } from '@/lib/queries/settings';
import { formatPeso, getSlot } from '@/lib/schedule';
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

  const { payment } = await getSettings();
  const slot = getSlot(booking.slotIndex);
  const owes = booking.amount > 0 && booking.paymentStatus !== 'paid';

  return (
    <div className="space-y-5">
      <section className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {headline(booking.status)}
        </h1>
        <p className="mt-2">
          <StatusBadge status={booking.status} />
        </p>
        <p className="mt-2 text-sm text-muted">{subtitle(booking.status)}</p>
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
          <Row
            label="Price"
            value={booking.amount > 0 ? formatPeso(booking.amount) : 'Free'}
          />
          <Row label="Reference" value={booking.code} mono />
        </dl>

        {booking.amount > 0 ? (
          <p className="mt-3 border-t border-edge pt-3">
            <PaymentBadge
              paymentStatus={booking.paymentStatus}
              amount={booking.amount}
            />
          </p>
        ) : null}

        {booking.decisionNote ? (
          <p className="mt-3 border-t border-edge pt-3 text-sm text-muted">
            Association note: {booking.decisionNote}
          </p>
        ) : null}
      </section>

      {owes && isPaymentConfigured(payment) ? (
        <PaymentInstructions
          payment={payment}
          amount={booking.amount}
          code={booking.code}
        />
      ) : null}

      {owes && !isPaymentConfigured(payment) ? (
        <p className="rounded-xl border border-edge bg-surface px-3.5 py-3 text-sm text-muted">
          The association will contact you about paying {formatPeso(booking.amount)}.
        </p>
      ) : null}

      <PrimaryLink href="/my">Go to my bookings</PrimaryLink>
    </div>
  );
}

function headline(status: string): string {
  if (status === 'confirmed') return 'Your booking is confirmed';
  if (status === 'rejected') return 'Request declined';
  if (status === 'cancelled') return 'Booking cancelled';
  return 'Request received';
}

function subtitle(status: string): string {
  if (status === 'confirmed') return 'Please arrive a few minutes early.';
  if (status === 'rejected') return 'The slot has been released.';
  if (status === 'cancelled') return 'This slot has been released.';
  return 'The association will review it shortly. You can check back here or under My bookings.';
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
      <dd
        className={`text-right font-medium ${mono ? 'font-mono tracking-widest' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
