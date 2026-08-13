import Link from 'next/link';
import { notFound } from 'next/navigation';

import { bookerLabel } from '@/components/booker-label';
import { PaymentBadge, StatusBadge } from '@/components/booking-status';
import { PaymentInstructions } from '@/components/payment-instructions';
import { PaymentProofUpload } from '@/components/payment-proof-upload';
import { PaymentReferenceForm } from '@/components/payment-reference-form';
import { Card, Notice, PrimaryLink, SportBadge } from '@/components/ui';
import { isValidBookingCode, normalizeBookingCode } from '@/lib/booking-code';
import { encodeOwner, phoneOwner, type Owner } from '@/lib/owner';
import { isPaymentConfigured } from '@/lib/payment';
import { isBlobConfigured } from '@/lib/payment-proof';
import { getBookingByCode, type BookingWithUnit } from '@/lib/queries/bookings';
import { getSettings } from '@/lib/queries/settings';
import { formatPeso, getSlot } from '@/lib/schedule';
import { formatLongDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

/** The identity that proves this booking is yours, same as a lookup returns. */
function ownerFor(booking: BookingWithUnit): Owner {
  if (booking.bookerType === 'resident' && booking.unitKey) {
    return { kind: 'unit', key: booking.unitKey };
  }
  return phoneOwner(booking.phone);
}

export default async function BookingPage({
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
  const awaitingCheck = booking.paymentStatus === 'submitted';
  const owner = encodeOwner(ownerFor(booking));

  return (
    <div className="space-y-5">
      <section className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {headline(booking, owes, awaitingCheck)}
        </h1>
        <p className="mt-2">
          <StatusBadge status={booking.status} />
        </p>
        <p className="mt-2 text-sm text-muted">
          {subtitle(booking, owes, awaitingCheck)}
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

      {owes ? (
        isPaymentConfigured(payment) ? (
          <>
            <PaymentInstructions
              payment={payment}
              amount={booking.amount}
              code={booking.code}
            />

            <Card>
              <div className="space-y-4">
                {isBlobConfigured() ? (
                  <PaymentProofUpload
                    bookingId={booking.id}
                    owner={owner}
                    existingUrl={booking.paymentProofUrl}
                  />
                ) : null}
                <PaymentReferenceForm
                  bookingId={booking.id}
                  owner={owner}
                  existing={booking.paymentRef}
                />
              </div>
            </Card>
          </>
        ) : (
          <Notice>
            The association will contact you about paying{' '}
            {formatPeso(booking.amount)}.
          </Notice>
        )
      ) : null}

      {booking.amount > 0 && booking.paymentStatus === 'paid' ? (
        <Notice tone="success">
          Payment received. Nothing more to do.
        </Notice>
      ) : null}

      <div className="space-y-2">
        <PrimaryLink href="/my">Go to my bookings</PrimaryLink>
        <Link
          href="/book"
          className="block text-center text-sm font-medium text-court underline"
        >
          Book another slot
        </Link>
      </div>
    </div>
  );
}

function headline(
  booking: BookingWithUnit,
  owes: boolean,
  awaitingCheck: boolean,
): string {
  if (booking.status === 'confirmed') return 'Your booking is confirmed';
  if (booking.status === 'rejected') return 'Request declined';
  if (booking.status === 'cancelled') return 'Booking cancelled';
  if (awaitingCheck) return 'Checking your payment';
  if (owes) return 'Almost there — pay to confirm';
  return 'Request received';
}

function subtitle(
  booking: BookingWithUnit,
  owes: boolean,
  awaitingCheck: boolean,
): string {
  if (booking.status === 'confirmed') {
    return 'Please arrive 10–15 minutes early.';
  }
  if (booking.status === 'rejected') return 'The slot has been released.';
  if (booking.status === 'cancelled') return 'This slot has been released.';
  if (awaitingCheck) {
    return 'We have your payment details. The association will confirm the booking shortly.';
  }
  if (owes) {
    return 'Your slot is held while you pay. Send the fee, then upload your receipt below.';
  }
  return 'The association will review it shortly.';
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
